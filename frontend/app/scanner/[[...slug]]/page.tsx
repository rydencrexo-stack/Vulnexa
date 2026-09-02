import { ProductRoute } from "@/features/security-console/ProductRoute";
import { redirect } from "next/navigation";

export default async function ScannerPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;

  if (slug[0] === "active") {
    redirect("/active-scanner");
  }

  return <ProductRoute area="scanner" segments={slug} />;
}

