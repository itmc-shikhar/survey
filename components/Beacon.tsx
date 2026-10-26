"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

// Counts landing-page visits (anonymous) so the insights funnel starts at "visited".
export default function Beacon() {
  useEffect(() => track(crypto.randomUUID(), "landing"), []);
  return null;
}
