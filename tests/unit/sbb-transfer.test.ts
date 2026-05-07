import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAccessAssessment,
  calculateDestinationAssessment,
  calculateTransferAssessments,
  searchConnections,
} from "../../src/lib/sbb.ts";

function makeDataset() {
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
      ["8507000:0:5", { lat: 46.9485, lon: 7.437 }],
      ["8507000:0:49", { lat: 46.9485, lon: 7.4405 }],
      ["spiez-schiffstation", { lat: 46.6869, lon: 7.6712 }],
      ["spiez-bahnhof", { lat: 46.7041, lon: 7.6712 }],
      ["spiez-bahnhofstr-45", { lat: 46.7163, lon: 7.6714 }],
      ["jegenstorf-bahnhof", { lat: 47.0516, lon: 7.5231 }],
    ]),
    transferRules: new Map(),
  };
}

function makeMockConnection(departure, arrival) {
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

async function withNetworkDisabled(fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network disabled in unit test");
  };

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withMockFetch(fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push(url);

    if (url.includes("nominatim.openstreetmap.org/search")) {
      return new Response(JSON.stringify([{ lat: "46.7163", lon: "7.6714" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("transport.opendata.ch/v1/locations")) {
      const query = new URL(url).searchParams.get("query") || "";
      const stationMap = new Map([
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
      const [hours, minutes] = requestedTime.split(":").map((part) => Number.parseInt(part, 10));
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
  };

  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("Bern platform transfer uses a GTFS-based walking estimate", async () => {
  await withNetworkDisabled(async () => {
    const dataset = makeDataset();
    const connection = {
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
    assert.equal(transfers.length, 1);

    const transfer = transfers[0];
    assert.equal(transfer.givenMinutes, 16);
    assert.equal(transfer.walkMinutes, null);
    assert.equal(transfer.requiredMinutes, 6);
    assert.equal(transfer.slackMinutes, 10);
    assert.equal(transfer.tone, "plenty");
  });
});

test("Spiez Schiffstation access walk is based on the real walking distance", async () => {
  await withNetworkDisabled(async () => {
    const dataset = makeDataset();
    const connection = {
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
    assert.ok(access, "expected an access assessment for the leading walk");
    assert.equal(access?.givenMinutes, 22);
    assert.equal(access?.walkMinutes, 22);
    assert.equal(access?.requiredMinutes, 30);
    assert.equal(access?.slackMinutes, -8);
    assert.equal(access?.tone, "tight");
    assert.ok((access?.walkDistanceMeters || 0) > 1800);
  });
});

test("Spiez Bahnhofstrasse destination walk is based on the real walking distance", async () => {
  await withNetworkDisabled(async () => {
    const dataset = makeDataset();
    const connection = {
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
    assert.ok(destination, "expected a destination access assessment");
    assert.equal(destination?.givenMinutes, 19);
    assert.equal(destination?.walkMinutes, 19);
    assert.ok(destination?.walkDistanceMeters !== null);
    assert.ok((destination?.walkDistanceMeters || 0) > 1000);
    assert.ok(destination?.requiredMinutes !== null);
    assert.ok((destination?.requiredMinutes || 0) > 2);
  });
});

test("destination walk without an explicit walking leg still gets an estimated time", async () => {
  await withNetworkDisabled(async () => {
    const dataset = makeDataset();
    const connection = {
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
    assert.ok(destination, "expected a destination access assessment");
    assert.ok((destination?.givenMinutes || 0) > 0);
    assert.ok((destination?.requiredMinutes || 0) > 0);
    assert.ok(destination?.walkDistanceMeters !== null);
    assert.ok((destination?.walkDistanceMeters || 0) > 0);
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

    assert.ok(result.connections.length > 0);
    assert.equal(result.connections[0].to, "Spiez, Bahnhofstr. 45");
    assert.equal(result.connections[0].departure, "10:47");
    assert.equal(result.connections[0].arrival, "12:06");
    assert.ok(result.connections[0].destinationAssessment, "expected a destination walk assessment");

    const connectionUrl = calls.find((url) => url.includes("transport.opendata.ch/v1/connections"));
    assert.ok(connectionUrl, "expected a connections API call");

    const params = new URL(connectionUrl).searchParams;
    assert.notEqual(params.get("to"), "Spiez, Bahnhofstr. 45");
    assert.equal(params.get("limit"), "16");
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

    assert.equal(forward.connections.length, 3);
    assert.deepEqual(
      forward.connections.map((connection) => connection.departure),
      ["10:47", "12:06", "13:43"]
    );
    assert.equal(forward.connections[0].to, "Spiez, Bahnhofstr. 45");
    assert.ok(forward.connections[0].destinationAssessment, "expected a destination walk assessment");

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

    assert.equal(reverse.connections.length, 3);
    assert.deepEqual(
      reverse.connections.map((connection) => connection.departure),
      ["10:50", "11:25", "12:10"]
    );
    assert.equal(reverse.connections[0].from, "Spiez, Bahnhofstr. 45");
    assert.ok(reverse.connections[0].accessAssessment, "expected an access walk assessment");

    const connectionUrls = calls.filter((url) => url.includes("transport.opendata.ch/v1/connections"));
    assert.ok(connectionUrls.length >= 2);

    const forwardParams = new URL(connectionUrls[0]).searchParams;
    const reverseParams = new URL(connectionUrls[1]).searchParams;

    assert.notEqual(forwardParams.get("to"), "Spiez, Bahnhofstr. 45");
    assert.notEqual(reverseParams.get("from"), "Spiez, Bahnhofstr. 45");
    assert.equal(forwardParams.get("limit"), "16");
    assert.equal(reverseParams.get("limit"), "16");
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

    assert.equal(result.connections.length, 3);
    assert.deepEqual(
      result.connections.map((connection) => connection.departure),
      ["23:50", "07:30", "08:00"]
    );
    assert.equal(result.connections[0].departure, "23:50");
    assert.equal(result.connections[0].arrival, "11:30");
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

    assert.ok(result.connections.length > 0);
    assert.equal(result.connections[0].to, "Jegenstorf, Hofuurenweg 1");

    const locationsCalls = calls.filter((url) => url.includes("transport.opendata.ch/v1/locations"));
    assert.ok(locationsCalls.some((url) => new URL(url).searchParams.get("query") === "Jegenstorf"));

    const connectionUrl = calls.find((url) => url.includes("transport.opendata.ch/v1/connections"));
    assert.ok(connectionUrl, "expected a connections API call");
    assert.notEqual(new URL(connectionUrl).searchParams.get("to"), "Jegenstorf, Hofuurenweg 1 ");
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

    assert.ok(outboundDeparture.connections.length > 0);
    assert.ok(outboundArrival.connections.length > 0);
    assert.ok(inboundDeparture.connections.length > 0);
    assert.ok(inboundArrival.connections.length > 0);
  });
});
