import type { Metadata } from "next";
import Survey from "@/components/Survey";

export const metadata: Metadata = { title: "Survey — Noticed" };

export default function SurveyPage() {
  return <Survey />;
}
