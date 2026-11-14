-- Pelo app o gestor edita a ficha da unidade, mas não muda código, empreendimento nem imobiliária
-- (o código liga a unidade ao objeto do 3D e aos leads). Mudanças assim: importação (função) ou SQL.
REVOKE UPDATE ON units FROM authenticated;
--> statement-breakpoint
GRANT UPDATE (floor, position, area_m2, bedrooms, parking, price, status, plan_url, mesh_name)
  ON units TO authenticated;
