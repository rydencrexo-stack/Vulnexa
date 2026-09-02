import { ProductRoute } from "@/features/security-console/ProductRoute";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ProductRoute area="settings" segments={slug} />;
}

