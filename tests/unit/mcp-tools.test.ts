import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { coordinateToAddressTool } from "@/lib/mcp/coordinate-to-address";
import { nearbyPlaceTool } from "@/lib/mcp/nearby-place";
import { _webSearchTestInternals, buildWebSearchObservation, type WebSearchRaw, type WebSearchResult } from "@/lib/mcp/web-search/resources";
import { webSearchTool } from "@/lib/mcp/web-search";
import type { McpToolContext } from "@/lib/mcp";

vi.mock("@/lib/mcp/structured-json", () => ({
  inferStructuredJson: vi.fn(async () => ({ value: null, text: "" })),
}));

type FetchMock = typeof fetch;

function baseContext(overrides: Partial<McpToolContext> = {}): McpToolContext {
  return {
    message: "Migros Öffnungszeiten in der Nähe",
    history: [],
    language: "de",
    trace: [],
    runtime: undefined,
    ...overrides,
  };
}

function coordinateObservationPayload() {
  return JSON.stringify({
    latitude: 46.94797,
    longitude: 7.44745,
    accuracy: 25,
    label: "Bundesplatz, Bern, Schweiz",
    addressLine: "Bundesplatz, 3011 Bern, Schweiz",
    city: "Bern",
    postcode: "3011",
    country: "Schweiz",
    displayName: "Bundesplatz, Bern, Verwaltungskreis Bern-Mittelland, Bern, Schweiz",
    source: "nominatim.openstreetmap.org",
    error: null,
  });
}

function nearbyPlaceObservationPayload() {
  return JSON.stringify({
    searchTerm: "Migros Supermarkt",
    resolvedPlace: "Migros-Supermarkt - Spiez - Terminus",
    source: "nominatim.openstreetmap.org",
    warning: null,
    error: null,
    results: [{
      name: "Migros-Supermarkt - Spiez - Terminus",
      addressLine: "Bahnhofstrasse 1, 3700 Spiez, Schweiz",
      city: "Spiez",
      postcode: "3700",
      country: "Schweiz",
      lat: 46.6882,
      lon: 7.6791,
      distanceMeters: 380,
      displayName: "Migros-Supermarkt - Spiez - Terminus, Bahnhofstrasse 1, 3700 Spiez, Schweiz",
      category: "shop",
      type: "supermarket",
      source: "nominatim.openstreetmap.org",
    }],
  });
}

describe("coordinate_to_address MCP", () => {
  let originalFetch: FetchMock;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("builds a request from browser coordinates without asking another MCP", async () => {
    const request = await coordinateToAddressTool.buildRequest(baseContext({
      runtime: {
        location: {
          latitude: 46.94797,
          longitude: 7.44745,
          accuracy: 25,
        },
      },
    }));

    expect(request.ok).toBe(true);
    if (request.ok) {
      expect(request.args).toEqual({
        latitude: 46.94797,
        longitude: 7.44745,
        accuracy: 25,
      });
      expect(request.requestSummary).toContain("46.94797");
    }
  });

  test("asks for a place when no browser coordinates are available", async () => {
    const request = await coordinateToAddressTool.buildRequest(baseContext({ runtime: undefined }));

    expect(request.ok).toBe(false);
    if (!request.ok) {
      expect(request.clarification).toBe("Für welchen Ort soll ich suchen?");
    }
  });

  test("reverse geocodes with Nominatim and emits structured payload", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("nominatim.openstreetmap.org/reverse");
      expect(url).toContain("lat=46.94797");
      expect(url).toContain("lon=7.44745");

      return new Response(JSON.stringify({
        display_name: "Bundesplatz, Bern, Verwaltungskreis Bern-Mittelland, Bern, Schweiz",
        name: "Bundesplatz",
        address: {
          road: "Bundesplatz",
          postcode: "3011",
          city: "Bern",
          state: "Bern",
          country: "Schweiz",
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as FetchMock;

    const raw = await coordinateToAddressTool.execute({ latitude: 46.94797, longitude: 7.44745 }, "de", baseContext());
    const observation = await coordinateToAddressTool.renderObservation(raw, "de", "Standort auflösen", baseContext());

    expect(observation.status).toBe("ok");
    expect(observation.resultSummary).toContain("Bundesplatz");
    expect(JSON.parse(observation.payload || "{}")).toMatchObject({
      label: expect.stringContaining("Bundesplatz"),
      city: "Bern",
      source: "nominatim.openstreetmap.org",
    });
  });
});

describe("nearby_place MCP", () => {
  let originalFetch: FetchMock;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("prioritizes the nearest Migros supermarket over the restaurant page", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("nominatim.openstreetmap.org/search");
      expect(url).toContain("Migros+Supermarkt");

      return new Response(JSON.stringify([
        {
          name: "Migros Restaurant Spiez",
          lat: "46.6880",
          lon: "7.6788",
          display_name: "Migros Restaurant Spiez, Spiez, Schweiz",
          address: {
            road: "Bahnhofstrasse",
            city: "Spiez",
            postcode: "3700",
            country: "Schweiz",
          },
          class: "amenity",
          type: "restaurant",
        },
        {
          name: "Migros-Supermarkt - Spiez - Terminus",
          lat: "46.6882",
          lon: "7.6791",
          display_name: "Migros-Supermarkt - Spiez - Terminus, Bahnhofstrasse 1, 3700 Spiez, Schweiz",
          address: {
            road: "Bahnhofstrasse",
            house_number: "1",
            city: "Spiez",
            postcode: "3700",
            country: "Schweiz",
          },
          class: "shop",
          type: "supermarket",
        },
      ]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as FetchMock;

    const raw = await nearbyPlaceTool.execute({
      query: "Welche Migros ist gerade am nächsten zu mir offen?",
      latitude: 46.6885,
      longitude: 7.6782,
      accuracy: 35,
    }, "de", baseContext());
    const observation = await nearbyPlaceTool.renderObservation(raw, "de", "Nächsten Migros suchen", baseContext());

    expect(raw.resolvedPlace).toBe("Migros-Supermarkt - Spiez - Terminus, Bahnhofstrasse 1, 3700 Spiez, Schweiz");
    expect(observation.status).toBe("ok");
    expect(observation.resultSummary).toContain("Migros-Supermarkt - Spiez - Terminus");
  });
});

describe("web_search MCP", () => {
  test("declares nearby_place as a dependency for local browser searches", () => {
    const context = baseContext({
      message: "Wann hat die Migros in der Nähe offen?",
      runtime: {
        location: {
          latitude: 46.94797,
          longitude: 7.44745,
          accuracy: 25,
        },
      },
    });

    expect(webSearchTool.requires?.(context)).toEqual(["nearby_place"]);
  });

  test("prefers nearby_place before coordinate_to_address for nearest-place lookups", () => {
    const context = baseContext({
      message: "Welche Migros ist gerade am nächsten zu mir offen?",
      runtime: {
        location: {
          latitude: 46.6885,
          longitude: 7.6782,
          accuracy: 35,
        },
      },
    });

    expect(coordinateToAddressTool.canHandle?.(context)).toBe(false);
    expect(webSearchTool.requires?.(context)).toEqual(["nearby_place"]);
  });

  test("still requests nearby_place after a coordinate observation until the nearby place is resolved", () => {
    const context = baseContext({
      message: "Wann hat die Migros in der Nähe offen?",
      runtime: {
        location: {
          latitude: 46.94797,
          longitude: 7.44745,
          accuracy: 25,
        },
      },
      trace: [{
        toolName: "coordinate_to_address",
        requestSummary: "Standort auflösen",
        resultSummary: "Ungefährer Standort: Bundesplatz, Bern, Schweiz",
        status: "ok",
        payload: coordinateObservationPayload(),
      }],
    });

    expect(webSearchTool.requires?.(context)).toEqual(["nearby_place"]);
  });

  test("does not reverse geocode browser location for explicit address queries", () => {
    const context = baseContext({
      message: "Wann ist die nächste Abfuhr an der Examplefeldstrasse in Bern?",
      runtime: {
        location: {
          latitude: 46.6885,
          longitude: 7.6782,
          label: "Spiez, Schweiz",
        },
      },
    });

    expect(coordinateToAddressTool.canHandle?.(context)).toBe(false);
  });

  test("does not reverse geocode browser location for explicit city queries", () => {
    const context = baseContext({
      message: "Wo ist das nächste Museum in Spiez?",
      runtime: {
        location: {
          latitude: 46.6885,
          longitude: 7.6782,
          label: "Spiez, Schweiz",
        },
      },
    });

    expect(coordinateToAddressTool.canHandle?.(context)).toBe(false);
  });

  test("reverse geocodes nearby product searches instead of treating product purpose as a place", async () => {
    const context = baseContext({
      message: "Wo bekomme ich Batterien für ein Hörgerät in der Nähe?",
      runtime: {
        location: {
          latitude: 46.6885,
          longitude: 7.6782,
          label: "Spiez, Schweiz",
        },
      },
    });

    expect(coordinateToAddressTool.canHandle?.(context)).toBe(true);

    const request = await webSearchTool.buildRequest(context);

    expect(request.ok).toBe(true);
    if (request.ok) {
      expect(request.args).toMatchObject({
        intent: "product",
        location: {
          latitude: 46.6885,
          longitude: 7.6782,
          label: "Spiez, Schweiz",
        },
      });
      expect(request.args.resolvedPlace).toBeUndefined();
    }
  });

  test("keeps explicit product-search cities separate from product terms", async () => {
    const context = baseContext({
      message: "Wo kann ich in Spiez lactosefreie Milch kaufen?",
      runtime: {
        location: {
          latitude: 46.6885,
          longitude: 7.6782,
          label: "Bern, Schweiz",
        },
      },
    });

    const request = await webSearchTool.buildRequest(context);

    expect(request.ok).toBe(true);
    if (request.ok) {
      expect(request.args).toMatchObject({
        intent: "product",
        resolvedPlace: "Spiez",
      });
      expect(request.args.location).toBeUndefined();
    }
  });

  test("keeps informational preparedness lookups as topic searches", async () => {
    const context = baseContext({
      message: "Wo finde ich den aktuellen Notfallplan bei Stromausfall in der Schweiz?",
      runtime: {
        location: {
          latitude: 46.6885,
          longitude: 7.6782,
          label: "Spiez, Schweiz",
        },
      },
    });

    expect(webSearchTool.requires?.(context)).toEqual([]);

    const request = await webSearchTool.buildRequest(context);

    expect(request.ok).toBe(true);
    if (request.ok) {
      expect(request.args).toMatchObject({ intent: "topic" });
      expect(request.args.location).toBeUndefined();
      expect(request.args.resolvedPlace).toBeUndefined();
    }
  });

  test("does not add browser location to non-local product comparisons", async () => {
    const context = baseContext({
      message: "Vergleiche Hörgeräte Batterietyp 312 und 13",
      runtime: {
        location: {
          latitude: 46.6885,
          longitude: 7.6782,
          label: "Spiez, Schweiz",
        },
      },
    });

    expect(webSearchTool.requires?.(context)).toEqual([]);

    const request = await webSearchTool.buildRequest(context);

    expect(request.ok).toBe(true);
    if (request.ok) {
      expect(request.args).toMatchObject({ intent: "product" });
      expect(request.args.location).toBeUndefined();
      expect(request.args.resolvedPlace).toBeUndefined();
    }
  });

  test("builds a web request from the current message and previous coordinate observation", async () => {
    const context = baseContext({
      message: "Migros Öffnungszeiten",
      runtime: {
        location: {
          latitude: 46.94797,
          longitude: 7.44745,
          accuracy: 25,
        },
      },
      trace: [{
        toolName: "coordinate_to_address",
        requestSummary: "Standort auflösen",
        resultSummary: "Ungefährer Standort: Bundesplatz, Bern, Schweiz",
        status: "ok",
        payload: coordinateObservationPayload(),
      }],
    });

    const request = await webSearchTool.buildRequest(context);

    expect(request.ok).toBe(true);
    if (request.ok) {
      expect(request.args).toMatchObject({
        query: "Migros Öffnungszeiten",
        intent: "opening_hours",
        resolvedPlace: "Bundesplatz, Bern, Schweiz",
      });
      expect(request.requestSummary).toContain("Bundesplatz, Bern, Schweiz");
    }
  });

  test("renders structured web search observations without making URLs part of the answer text", () => {
    const raw: WebSearchRaw = {
      query: "Migros Öffnungszeiten Bundesplatz Bern",
      intent: "opening_hours",
      resolvedPlace: "Bundesplatz, Bern, Schweiz",
      searchedAt: "2026-05-10T10:00:00.000Z",
      results: [{
        title: "Migros Markt Bern",
        url: "https://example.org/migros-bern",
        domain: "example.org",
        snippet: "Heute geöffnet von 08:00 bis 19:00.",
        text: "Adresse: Beispielstrasse 1, Bern. Telefon: 031 000 00 00.",
      }],
    };

    const observation = buildWebSearchObservation(raw, "de", "Websuche");

    expect(observation.status).toBe("ok");
    expect(observation.resultSummary).toContain("Quelle: example.org");
    expect(observation.resultSummary).not.toContain("https://example.org");
    expect(JSON.parse(observation.payload || "{}")).toMatchObject({
      query: "Migros Öffnungszeiten Bundesplatz Bern",
      results: [{ url: "https://example.org/migros-bern" }],
    });
  });

  test("enriches local search queries with intent hints and resolved place", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Migros Öffnungszeiten",
      intent: "opening_hours",
      resolvedPlace: "Bundesplatz, Bern, Schweiz",
      maxResults: 6,
    }, "de");

    expect(query).toContain("Migros Öffnungszeiten");
    expect(query).toContain("Öffnungszeiten Adresse Telefon");
    expect(query).toContain("Supermarkt Filiale");
    expect(query).toContain("Bern");
  });

  test("keeps explicit place queries from receiving duplicate browser-location text", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Stadttheater in Bern Adresse",
      intent: "venue",
      location: {
        latitude: 46.6885,
        longitude: 7.6782,
        label: "Spiez, Schweiz",
      },
      maxResults: 6,
    }, "de");

    expect(query).toContain("Stadttheater in Bern Adresse");
    expect(query).not.toContain("Spiez");
    expect(query).not.toContain("46.6885");
  });

  test("compacts nearby opening-hour questions to entity, intent, and city", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Welche Migros ist gerade am nächsten zu mir offen?",
      intent: "opening_hours",
      resolvedPlace: "Bahnhofstrasse 19, Spiez, Bern/Berne",
      maxResults: 6,
    }, "de");

    expect(query).toContain("Migros");
    expect(query).toContain("Öffnungszeiten Adresse Telefon");
    expect(query).toContain("Spiez");
    expect(query).not.toContain("Bahnhofstrasse");
    expect(query).not.toContain("welche");
  });

  test("extracts practical facts from crawled page markdown", () => {
    const extracted = _webSearchTestInternals.extractUsefulInfo([
      "# Migros Markt Bern Bahnhof",
      "Adresse: Bahnhofplatz 10, 3011 Bern",
      "Öffnungszeiten: Montag - Freitag 08:00 - 20:00, Samstag 08:00 - 18:00",
      "Telefon +41 31 555 12 34",
      "E-Mail kontakt@example.org",
    ].join("\n"), "Migros Markt Bern Bahnhof");

    expect(extracted.addresses).toContain("Adresse: Bahnhofplatz 10, 3011 Bern");
    expect(extracted.openingHours[0]).toContain("08:00");
    expect(extracted.phones).toEqual(["+41 31 555 12 34"]);
    expect(extracted.emails).toEqual(["kontakt@example.org"]);
  });

  test("ranks emergency pharmacy pages with phone and emergency wording above generic results", () => {
    const generic: WebSearchResult = {
      title: "Apotheken in Bern",
      url: "https://directory.example/apotheken",
      domain: "directory.example",
      snippet: "Liste von Apotheken.",
    };
    const emergency: WebSearchResult = {
      title: "Notfallapotheke Bern heute",
      url: "https://apotheke.example/notfall",
      domain: "apotheke.example",
      snippet: "Notdienst und Telefonnummer.",
      markdown: "Notfallapotheke Bern\nAdresse: Marktgasse 1, 3011 Bern\nTelefon +41 31 555 99 88",
      extracted: {
        phones: ["+41 31 555 99 88"],
        openingHours: [],
        addresses: ["Adresse: Marktgasse 1, 3011 Bern"],
        emails: [],
        likelyNames: ["Notfallapotheke Bern heute"],
        scheduleRows: [],
        documentFacts: [],
      },
    };

    const ranked = _webSearchTestInternals.rankResults({
      query: "nächste Notfallapotheke",
      intent: "emergency_pharmacy",
      resolvedPlace: "Bern, Schweiz",
    }, [generic, emergency]);

    expect(ranked[0]).toBe(emergency);
  });

  test("enriches programme queries with schedule terms instead of address-only terms", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Gib mir das Programm vom Theater Bern",
      intent: "venue",
      maxResults: 6,
    }, "de");

    expect(query).toContain("Programm Spielplan Veranstaltungen Termine");
    expect(query).not.toContain("Adresse offizieller Ort");
  });

  test("enriches temporal event queries with schedule terms instead of address-only terms", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Welche Konzerte gibt es diese Woche in Thun?",
      intent: "venue",
      resolvedPlace: "Thun",
      maxResults: 6,
    }, "de");

    expect(query).toContain("Programm Spielplan Veranstaltungen Termine");
    expect(query).toContain("Thun");
    expect(query).not.toContain("Adresse offizieller Ort");
  });

  test("enriches collection schedule queries with calendar document terms", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Wann ist die nächste Abfuhr an der Examplefeldstrasse in Bern?",
      intent: "topic",
      maxResults: 6,
    }, "de");

    expect(query).toContain("Entsorgungskalender Abfuhrdaten PDF");
    expect(query).not.toContain("Adresse offizieller Ort");
  });

  test("enriches compound collection schedule words with calendar document terms", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Wann ist die nächste Kehrichtabfuhr an der Breitfeldstrasse in Bern?",
      intent: "local",
      resolvedPlace: "Bern",
      maxResults: 6,
    }, "de");

    expect(query).toContain("Entsorgungskalender Abfuhrdaten PDF");
    expect(query).toContain("Bern");
  });

  test("enriches disposal lookups without collection-calendar terms", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Wie entsorge ich alte Medikamente in Bern?",
      intent: "local",
      resolvedPlace: "Bern",
      maxResults: 6,
    }, "de");

    expect(query).toContain("Entsorgung Abgabestelle offizieller Ort");
    expect(query).toContain("Bern");
    expect(query).not.toContain("Entsorgungskalender");
  });

  test("enriches non-local product comparisons without shopping-place terms", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Vergleiche Hörgeräte Batterietyp 312 und 13",
      intent: "product",
      maxResults: 6,
    }, "de");

    expect(query).toContain("Vergleich Test Empfehlung Preis");
    expect(query).not.toContain("wo kaufen");
    expect(query).not.toContain("Geschäft");
  });

  test("enriches local product searches with store terms", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Wo kann ich in Spiez lactosefreie Milch kaufen?",
      intent: "product",
      resolvedPlace: "Spiez",
      maxResults: 6,
    }, "de");

    expect(query).toContain("laktosefrei");
    expect(query).not.toContain("lactosefrei");
    expect(query).toContain("Laden Geschäft Supermarkt Preis");
    expect(query).toContain("Spiez");
    expect(query).not.toContain("wo kaufen");
  });

  test("normalizes described hearing-aid battery searches to product terms", () => {
    const query = _webSearchTestInternals.buildSearchQuery({
      query: "Wo bekomme ich Batterien für ein Hörgerät in der Nähe?",
      intent: "product",
      resolvedPlace: "Spiez",
      maxResults: 6,
    }, "de");

    expect(query).toContain("Hörgerätebatterien");
    expect(query).toContain("Laden Geschäft Supermarkt Preis");
  });

  test("extracts dated programme rows for table-friendly answers", () => {
    const extracted = _webSearchTestInternals.extractUsefulInfo([
      "So 10.05.2026, 16:00 | Oper | La forza del destino | Hauptsaal",
      "Mo 11.05.2026, 18:00 | Sonderveranstaltungen | Milonga del Teatro | Foyer",
      "Di., 12. Mai 2026 19:30 Uhr | Kleiner Saal | Musik | Abendkonzert",
    ].join("\n"), "Programm");

    expect(extracted.scheduleRows).toEqual([
      {
        dateTime: "So 10.05.2026, 16:00",
        category: "Oper",
        title: "La forza del destino",
        venue: "Hauptsaal",
      },
      {
        dateTime: "Mo 11.05.2026, 18:00",
        category: "Sonderveranstaltungen",
        title: "Milonga del Teatro",
        venue: "Foyer",
      },
      {
        dateTime: "Di., 12. Mai 2026 19:30 Uhr",
        category: "Kleiner Saal",
        title: "Musik",
        venue: "Abendkonzert",
      },
    ]);
  });

  test("keeps longer programme tables in the web-search observation", () => {
    const rows = Array.from({ length: 30 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return `Mo ${day}.06.2026, 19:30 | Kategorie ${index + 1} | Veranstaltung ${index + 1} | Saal ${index + 1}`;
    });
    const extracted = _webSearchTestInternals.extractUsefulInfo(rows.join("\n"), "Programm");
    const raw: WebSearchRaw = {
      query: "Programm Spielplan",
      intent: "venue",
      resolvedPlace: null,
      searchedAt: "2026-05-10T10:00:00.000Z",
      results: [{
        title: "Programm",
        url: "https://example.org/programme",
        domain: "example.org",
        snippet: "",
        markdown: rows.join("\n"),
        extracted,
      }],
    };

    const observation = buildWebSearchObservation(raw, "de", "Websuche");

    expect(extracted.scheduleRows).toHaveLength(30);
    expect(observation.resultSummary).toContain("Veranstaltung 30");
  });

  test("extracts generic address-to-group document lookup facts", () => {
    const extracted = _webSearchTestInternals.extractUsefulInfo([
      "A5 Examplefeldstrasse B3 Otherstrasse",
      "Lesebeispiel Hauskehricht / brennbares Kleinsperrgut Papier / Karton Grüngut",
      "A5 Mo / Do jeden 2. Mi * Fr",
    ].join("\n"), "Kalender", {
      query: "Wann ist die nächste Abfuhr an der Examplefeldstrasse?",
      searchedAt: new Date("2026-05-10T10:00:00.000Z"),
    });

    expect(extracted.documentFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Examplefeldstrasse", value: "A5" }),
      expect.objectContaining({ label: "A5", value: "Mo / Do" }),
      expect.objectContaining({ label: "Nächster Termin", value: "Montag, 11.05.2026" }),
    ]));
  });

  test("uses named programme target instead of browser location", async () => {
    const context = baseContext({
      message: "Gib mir das Programm vom Theater Bern",
      runtime: {
        location: {
          latitude: 46.6885,
          longitude: 7.6782,
          label: "Spiez, Schweiz",
        },
      },
    });

    expect(webSearchTool.requires?.(context)).toEqual([]);

    const request = await webSearchTool.buildRequest(context);

    expect(request.ok).toBe(true);
    if (request.ok) {
      expect(request.args).toMatchObject({
        intent: "venue",
        resolvedPlace: "Theater Bern",
      });
      expect(request.args.location).toBeUndefined();
    }
  });
});
