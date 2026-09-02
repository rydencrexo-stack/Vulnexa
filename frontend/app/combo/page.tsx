import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "LeakSyr" };

export default function ComboPage() {
  redirect("https://leaksyr.com/");
}
