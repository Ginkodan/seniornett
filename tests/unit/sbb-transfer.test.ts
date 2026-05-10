import { describe, expect, test, vi } from "vitest";

import {
  calculateAccessAssessment,
  calculateDestinationAssessment,
  calculateTransferAssessments,
  searchConnections,
  type Connection,
  type Station,
} from "@/lib/sbb";

type TransferDataset = NonNullable<Parameters<typeof calculateTransferAssessments>[1]>;
type FetchMock = typeof fetch;

type MockApiConnection = {
  from: {
    departure: string;
    station: { name: string };
    platform: string;
  };
  to: {
    arrival: string;
    station: { name: string };
  };
  transfers: number;
  sections: Array<{
    journey: {
      number: string;
      category: string;
      to: string;
    };
    departure: {
      departure: string;
      station: { name: string };
      platform: string;
    };
    arrival: {
      arrival: string;
      station: { name: string };
      platform: string;
    };
  }>;
};

function makeDataset(): TransferDataset {
  return {
    stopIdsByStation: new Map([
      ["bern", ["8507000:0:5", "8507000:0:49"]],
      ["jegenstorf", ["jegenstorf-bahnhof"]],
      ["spiez schiffstation", ["spiez-schiffstation"]],
      ["spiez bahnhof", ["spiez-bahnhof"]],
      ["spiez bahnhofstr 45", ["spiez-bahnhofstr-45"]],
    ]),
    stopIdsByStationAndPlatform: new Map([
      ["bern|5", ["8507000:0:5"]],
      ["bern|49", ["8507000:0:49"]],
    ]),
    stopsById: new Map([
      ["8507000:0:5", { name: "Bern", lat: 46.9485, lon: 7.437 }],
      ["8507000:0:49", { name: "Bern", lat: 46.9485, lon: 7.4405 }],
      ["spiez-schiffstation", { name: "Spiez, Schiffstation", lat: 46.6869, lon: 7.6712 }],
      ["spiez-bahnhof", { name: "Spiez, Bahnhof", lat: 46.7041, lon: 7.6712 }],
      ["spiez-bahnhofstr-45", { name: "Spiez, Bahnhofstr. 45", lat: 46.7163, lon: 7.6714 }],
      ["jegenstorf-bahnhof", { name: "Jegenstorf", lat: 47.0516, lon: 7.5231 }],
    ]),
    transferRules: new Map(),
  };
}

function makeMockConnection(departure: string, arrival: string): MockApiConnection {
  return {
    from: {
      departure,
      station: { name: "Biel/Bienne" },
      platform: "7",
    },
    to: {
      arrival,
      station: { name: "Spiez, Bahnhof" },
    },
    transfers: 0,
    sections: [
      {
        journey: {
          number: "65",
          category: "IR",
          to: "Spiez",
        },
        departure: {
          departure,
          station: { name: "Biel/Bienne" },
          platform: "7",
        },
        arrival: {
          arrival,
          station: { name: "Spiez, Bahnhof" },
          platform: "4",
        },
      },
    ],
  };
}

function getFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function withNetworkDisabled<T>(fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => {
    throw new Error("network disabled in unit test");
  }) as FetchMock;

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withMockFetch<T>(fn: (calls: string[]) => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = getFetchUrl(input);
    calls.push(url);

    if (url.includes("nominatim.openstreetmap.org/search")) {
      return new Response(JSON.stringify([{ lat: "46.7163", lon: "7.6714" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("transport.opendata.ch/v1/locations")) {
      const query = new URL(url).searchParams.get("query") || "";
      const stationMap = new Map<string, Station>([
        ["Biel/Bienne", { id: "8503000", name: "Biel/Bienne" }],
        ["Spiez, Bahnhof", { id: "8507000", name: "Spiez, Bahnhof" }],
        ["Jegenstorf", { id: "8507483", name: "Jegenstorf" }],
      ]);
      const station = stationMap.get(query) || null;
      return new Response(JSON.stringify({ stations: station ? [station] : [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("transport.opendata.ch/v1/connections")) {
      const request = new URL(url);
      const isArrivalTime = request.searchParams.get("isArrivalTime") === "1";
      const requestedTime = request.searchParams.get("time") || "";
      const [hours = 0, minutes = 0] = requestedTime.split(":").map((part) => Number.parseInt(part, 10));
      const requestedMinutes = (hours * 60) + minutes;

      if (isArrivalTime) {
        return new Response(JSON.stringify({ connections: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const forwardSet = [
        makeMockConnection("2026-05-07T10:47:00.000", "2026-05-07T12:06:00.000"),
        makeMockConnection("2026-05-07T12:06:00.000", "2026-05-07T13:20:00.000"),
        makeMockConnection("2026-05-07T13:43:00.000", "2026-05-07T15:00:00.000"),
      ];
      const earlyFallbackSet = [
        makeMockConnection("2026-05-07T07:30:00.000", "2026-05-07T10:50:00.000"),
        makeMockConnection("2026-05-07T08:00:00.000", "2026-05-07T11:00:00.000"),
        makeMockConnection("2026-05-06T23:50:00.000", "2026-05-07T11:30:00.000"),
      ];
      const middayFallbackSet = [
        makeMockConnection("2026-05-07T10:50:00.000", "2026-05-07T11:00:00.000"),
        makeMockConnection("2026-05-07T11:25:00.000", "2026-05-07T12:06:00.000"),
        makeMockConnection("2026-05-07T12:10:00.000", "2026-05-07T15:00:00.000"),
      ];
      const lateDepartureSet = [
        makeMockConnection("2026-05-07T22:09:00.000", "2026-05-07T23:03:00.000"),
        makeMockConnection("2026-05-07T22:39:00.000", "2026-05-07T23:45:00.000"),
        makeMockConnection("2026-05-07T23:09:00.000", "2026-05-08T00:13:00.000"),
      ];
      const lateFallbackSet = [
        makeMockConnection("2026-05-07T20:10:00.000", "2026-05-07T20:59:00.000"),
        makeMockConnection("2026-05-07T20:40:00.000", "2026-05-07T21:31:00.000"),
        makeMockConnection("2026-05-07T21:20:00.000", "2026-05-07T22:01:00.000"),
      ];

      const connections = requestedMinutes === 10 * 60 + 47 || requestedMinutes === 10 * 60 + 41
        ? forwardSet
        : requestedMinutes === 22 * 60 + 3
          ? lateDepartureSet
          : requestedMinutes < 12 * 60
            ? earlyFallbackSet
            : requestedMinutes < 19 * 60
              ? middayFallbackSet
              : lateFallbackSet;

      return new Response(JSON.stringify({ connections }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as FetchMock;

  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe("SBB transfer and address routing", () => {
  test("Bern platform transfer uses a GTFS-based walking estimate", async () => {
    await withNetworkDisabled(async () => {
      const dataset = makeDataset();
      const connection: Connection = {
        from: "Spiez",
        to: "Biel/Bienne",
        departure: "19:23",
        arrival: "20:39",
        departureIso: "2026-05-07T17:23:00.000Z",
        arrivalIso: "2026-05-07T18:39:00.000Z",
        duration: "1h 16m",
        changes: 1,
        platform: "2",
        legs: [
          {
            number: "61",
            category: "IC",
            direction: "Basel SBB",
            departureTime: "19:23",
            arrivalTime: "19:56",
            departureStation: "Spiez",
            arrivalStation: "Bern",
            departurePlatform: "2",
            arrivalPlatform: "5",
          },
          {
            number: "65",
            category: "IR",
            direction: "Biel/Bienne",
            departureTime: "20:12",
            arrivalTime: "20:39",
            departureStation: "Bern",
            arrivalStation: "Biel/Bienne",
            departurePlatform: "49",
            arrivalPlatform: undefined,
          },
        ],
      };

      const transfers = await calculateTransferAssessments(connection, dataset);
      expect(transfers).toHaveLength(1);
      expect(transfers[0]).toMatchObject({
        givenMinutes: 16,
        walkMinutes: null,
        requiredMinutes: 6,
        slackMinutes: 10,
        tone: "plenty",
      });
    });
  });

  test("Spiez Schiffstation access walk is based on the real walking distance", async () => {
    await withNetworkDisabled(async () => {
      const dataset = makeDataset();
      const connection: Connection = {
        from: "Spiez, Schiffstation",
        to: "Biel/Bienne",
        departure: "12:55",
        arrival: "14:35",
        departureIso: "2026-05-07T10:55:00.000Z",
        arrivalIso: "2026-05-07T12:35:00.000Z",
        duration: "1h 40m",
        changes: 0,
        platform: undefined,
        legs: [
          {
            number: "–",
            category: "",
            direction: "",
            departureTime: "12:55",
            arrivalTime: "13:17",
            departureStation: "Spiez, Schiffstation",
            arrivalStation: "Spiez, Bahnhof",
            departurePlatform: undefined,
            arrivalPlatform: undefined,
          },
          {
            number: "61",
            category: "B",
            direction: "Spiez, Bahnhof",
            departureTime: "13:17",
            arrivalTime: "14:35",
            departureStation: "Spiez, Bahnhof",
            arrivalStation: "Biel/Bienne",
            departurePlatform: "4",
            arrivalPlatform: undefined,
          },
        ],
      };

      const access = await calculateAccessAssessment(connection, dataset);
      expect(access).toMatchObject({
        givenMinutes: 22,
        walkMinutes: 22,
        requiredMinutes: 30,
        slackMinutes: -8,
        tone: "tight",
      });
      expect(access?.walkDistanceMeters ?? 0).toBeGreaterThan(1800);
    });
  });

  test("Spiez Bahnhofstrasse destination walk is based on the real walking distance", async () => {
    await withNetworkDisabled(async () => {
      const dataset = makeDataset();
      const connection: Connection = {
        from: "Biel/Bienne",
        to: "Spiez, Bahnhofstr. 45",
        departure: "18:01",
        arrival: "20:58",
        departureIso: "2026-05-07T16:01:00.000Z",
        arrivalIso: "2026-05-07T18:58:00.000Z",
        duration: "2h 57m",
        changes: 1,
        platform: "2",
        destinationTargetCoords: { lat: 46.7163, lon: 7.6714 },
        legs: [
          {
            number: "65",
            category: "IR",
            direction: "Spiez",
            departureTime: "18:01",
            arrivalTime: "20:39",
            departureStation: "Biel/Bienne",
            arrivalStation: "Spiez, Bahnhof",
            departurePlatform: "2",
            arrivalPlatform: "4",
          },
          {
            number: "–",
            category: "",
            direction: "",
            departureTime: "20:39",
            arrivalTime: "20:58",
            departureStation: "Spiez, Bahnhof",
            arrivalStation: "Spiez, Bahnhofstr. 45",
            departurePlatform: undefined,
            arrivalPlatform: undefined,
          },
        ],
      };

      const destination = await calculateDestinationAssessment(connection, dataset);
      expect(destination?.givenMinutes).toBe(19);
      expect(destination?.walkMinutes).toBe(19);
      expect(destination?.walkDistanceMeters).not.toBeNull();
      expect(destination?.walkDistanceMeters ?? 0).toBeGreaterThan(1000);
      expect(destination?.requiredMinutes).not.toBeNull();
      expect(destination?.requiredMinutes ?? 0).toBeGreaterThan(2);
    });
  });

  test("destination walk without an explicit walking leg still gets an estimated time", async () => {
    await withNetworkDisabled(async () => {
      const dataset = makeDataset();
      const connection: Connection = {
        from: "Spiez",
        to: "Jegenstorf, Hofuurenweg 11",
        departure: "20:47",
        arrival: "22:03",
        departureIso: "2026-05-07T18:47:00.000Z",
        arrivalIso: "2026-05-07T20:03:00.000Z",
        duration: "1h 16m",
        changes: 0,
        platform: "4",
        destinationTargetCoords: { lat: 47.0512, lon: 7.5229 },
        legs: [
          {
            number: "65",
            category: "IR",
            direction: "Jegenstorf",
            departureTime: "20:47",
            arrivalTime: "22:03",
            departureStation: "Spiez",
            arrivalStation: "Jegenstorf",
            departurePlatform: "4",
            arrivalPlatform: undefined,
          },
        ],
      };

      const destination = await calculateDestinationAssessment(connection, dataset);
      expect(destination?.givenMinutes ?? 0).toBeGreaterThan(0);
      expect(destination?.requiredMinutes ?? 0).toBeGreaterThan(0);
      expect(destination?.walkDistanceMeters).not.toBeNull();
      expect(destination?.walkDistanceMeters ?? 0).toBeGreaterThan(0);
    });
  });

  test("address-like destination searches route via station but keep the real destination walk", async () => {
    await withMockFetch(async (calls) => {
      const result = await searchConnections(
        "Biel/Bienne",
        "Spiez, Bahnhofstr. 45",
        "2026-05-07",
        "10:41",
        false,
        1,
        true,
        6
      );

      expect(result.connections.length).toBeGreaterThan(0);
      expect(result.connections[0].to).toBe("Spiez, Bahnhofstr. 45");
      expect(result.connections[0].departure).toBe("10:47");
      expect(result.connections[0].arrival).toBe("12:06");
      expect(result.connections[0].destinationAssessment).toBeTruthy();

      const connectionUrl = calls.find((url) => url.includes("transport.opendata.ch/v1/connections"));
      expect(connectionUrl).toBeTruthy();

      const params = new URL(connectionUrl as string).searchParams;
      expect(params.get("to")).not.toBe("Spiez, Bahnhofstr. 45");
      expect(params.get("limit")).toBe("16");
    });
  });

  test("address searches keep Swiss-local time filtering and ordering in both directions", async () => {
    await withMockFetch(async (calls) => {
      const forward = await searchConnections(
        "Biel/Bienne",
        "Spiez, Bahnhofstr. 45",
        "2026-05-07",
        "10:47",
        false,
        1,
        true,
        6
      );

      expect(forward.connections).toHaveLength(3);
      expect(forward.connections.map((connection) => connection.departure)).toEqual(["10:47", "12:06", "13:43"]);
      expect(forward.connections[0].to).toBe("Spiez, Bahnhofstr. 45");
      expect(forward.connections[0].destinationAssessment).toBeTruthy();

      const reverse = await searchConnections(
        "Spiez, Bahnhofstr. 45",
        "Biel/Bienne",
        "2026-05-07",
        "15:47",
        true,
        1,
        true,
        6
      );

      expect(reverse.connections).toHaveLength(3);
      expect(reverse.connections.map((connection) => connection.departure)).toEqual(["10:50", "11:25", "12:10"]);
      expect(reverse.connections[0].from).toBe("Spiez, Bahnhofstr. 45");
      expect(reverse.connections[0].accessAssessment).toBeTruthy();

      const connectionUrls = calls.filter((url) => url.includes("transport.opendata.ch/v1/connections"));
      expect(connectionUrls.length).toBeGreaterThanOrEqual(2);

      const forwardParams = new URL(connectionUrls[0]).searchParams;
      const reverseParams = new URL(connectionUrls[1]).searchParams;

      expect(forwardParams.get("to")).not.toBe("Spiez, Bahnhofstr. 45");
      expect(reverseParams.get("from")).not.toBe("Spiez, Bahnhofstr. 45");
      expect(forwardParams.get("limit")).toBe("16");
      expect(reverseParams.get("limit")).toBe("16");
    });
  });

  test("arrival searches keep same-day arrivals even when the trip departs the previous day", async () => {
    await withMockFetch(async () => {
      const result = await searchConnections(
        "Spiez",
        "Biel/Bienne",
        "2026-05-07",
        "11:59",
        true,
        1,
        true,
        6
      );

      expect(result.connections).toHaveLength(3);
      expect(result.connections.map((connection) => connection.departure)).toEqual(["23:50", "07:30", "08:00"]);
      expect(result.connections[0].departure).toBe("23:50");
      expect(result.connections[0].arrival).toBe("11:30");
    });
  });

  test("arrival mode resolves address destinations to a station even when the street query needs stripping", async () => {
    await withMockFetch(async (calls) => {
      const result = await searchConnections(
        "Spiez",
        "Jegenstorf, Hofuurenweg 1 ",
        "2026-05-07",
        "22:01",
        true,
        1,
        true,
        6
      );

      expect(result.connections.length).toBeGreaterThan(0);
      expect(result.connections[0].to).toBe("Jegenstorf, Hofuurenweg 1");

      const locationsCalls = calls.filter((url) => url.includes("transport.opendata.ch/v1/locations"));
      expect(locationsCalls.some((url) => new URL(url).searchParams.get("query") === "Jegenstorf")).toBe(true);

      const connectionUrl = calls.find((url) => url.includes("transport.opendata.ch/v1/connections"));
      expect(connectionUrl).toBeTruthy();
      expect(new URL(connectionUrl as string).searchParams.get("to")).not.toBe("Jegenstorf, Hofuurenweg 1 ");
    });
  });

  test("Jegenstorf Hofuurenweg and Spiez work in both arrival and departure modes", async () => {
    await withMockFetch(async () => {
      const outboundDeparture = await searchConnections(
        "Jegenstorf, Hofuurenweg 1 ",
        "Spiez",
        "2026-05-07",
        "22:03",
        false,
        1,
        true,
        6
      );
      const outboundArrival = await searchConnections(
        "Jegenstorf, Hofuurenweg 1 ",
        "Spiez",
        "2026-05-07",
        "22:03",
        true,
        1,
        true,
        6
      );
      const inboundDeparture = await searchConnections(
        "Spiez",
        "Jegenstorf, Hofuurenweg 1 ",
        "2026-05-07",
        "22:03",
        false,
        1,
        true,
        6
      );
      const inboundArrival = await searchConnections(
        "Spiez",
        "Jegenstorf, Hofuurenweg 1 ",
        "2026-05-07",
        "22:03",
        true,
        1,
        true,
        6
      );

      expect(outboundDeparture.connections.length).toBeGreaterThan(0);
      expect(outboundArrival.connections.length).toBeGreaterThan(0);
      expect(inboundDeparture.connections.length).toBeGreaterThan(0);
      expect(inboundArrival.connections.length).toBeGreaterThan(0);
    });
  });
});
