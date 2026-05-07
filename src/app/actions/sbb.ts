"use server";

import { searchStations as libSearchStations, searchConnections as libSearchConnections } from "@/lib/sbb";

export async function searchStationsAction(query: string) {
  return libSearchStations(query);
}

export async function searchConnectionsAction(
  fromStation: string,
  toStation: string,
  date: string,
  time: string,
  isArrival: boolean = false,
  page: number = 1,
  applyInitialTimeFilter: boolean = true,
  limit: number = 6
) {
  return libSearchConnections(fromStation, toStation, date, time, isArrival, page, applyInitialTimeFilter, limit);
}
