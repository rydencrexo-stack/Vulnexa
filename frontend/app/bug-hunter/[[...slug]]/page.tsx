import { ProductRoute } from "@/features/security-console/ProductRoute";

export default async function BugHunterPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ProductRoute area="bug-hunter" segments={slug} />;
}
