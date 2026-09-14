import { redirect } from "next/navigation";
import { moscowDateIso } from "@/lib/shift-feedback/time";

export default function ShiftFeedbackIndexPage() {
  redirect(`/rop/shift/${moscowDateIso()}`);
}
