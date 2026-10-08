import { redirect } from "next/navigation";

// The inventory is the home page.
export default function HomePage() {
  redirect("/items");
}
