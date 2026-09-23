-- GENERATED FILE — review before applying.
-- Source: scripts/build-items-migration.ts over a checksum-verified snapshot
-- of cashflow_entries (spec 2026-09-25-cfp-p2b-standing-items-design.md 决策 5,
-- REVISED: each item's amount is its group's LATEST month, not an average —
-- averaging a multi-month client's split-across-months position was quietly
-- halving real figures like a client's salary).
-- The snapshot JSON holds every client's amounts and notes and is NEVER
-- committed. This file holds only ids, category codes, frequencies, dates
-- and booleans — every amount, name and review reason below is read back
-- from cashflow_entries at apply time via a scalar subquery over the exact
-- row ids the snapshot resolved them from.

do $$
declare
  v_count bigint;
  v_sum numeric;
  v_migrated bigint;
begin
  select count(*), coalesce(sum(amount), 0) into v_count, v_sum from public.cashflow_entries;
  if v_count <> 78 or abs(v_sum - 182231.5) > 0.01 then
    raise exception 'cashflow_entries has drifted from the migration snapshot (count % vs expected %, sum % vs expected %) — regenerate this migration before applying it',
      v_count, 78, v_sum, 182231.5;
  end if;

  select count(*) into v_migrated from public.cashflow_items where source = 'migrated';
  if v_migrated > 0 then
    raise exception 'public.cashflow_items already has % row(s) with source = migrated — this backfill has already been applied', v_migrated;
  end if;
end $$;

insert into public.cashflow_items (client_id, direction, category, name, amount, frequency, effective_from, effective_to, linked_asset_id, linked_liability_id, source, needs_review, review_reason, metadata)
select v.client_id, v.direction::public.cashflow_direction, v.category,
  (select (array_agg(e.source_note order by e.id desc))[1] from public.cashflow_entries e where e.id = any(v.amount_ids)),
  (select round(sum(e.amount), 2) from public.cashflow_entries e where e.id = any(v.amount_ids)),
  v.frequency::public.cashflow_frequency, v.effective_from, v.effective_to, v.linked_asset_id, v.linked_liability_id, 'migrated', v.needs_review,
  (select (array_remove(array_agg(e.review_reason order by e.period_month, e.id), null))[1] from public.cashflow_entries e where e.id = any(v.source_ids)),
  jsonb_build_object('migrated_from', v.source_ids, 'amount_from', v.amount_ids)
from (values
  ('04b4faec-78b8-4014-81bf-f3227b757c4f'::uuid, 'inflow', 'commission', 'monthly', date '2026-07-01', null::date, null::uuid, null::uuid, false, '{db89cbbf-c916-4d69-a5e6-74529dcedc7d}'::uuid[], '{db89cbbf-c916-4d69-a5e6-74529dcedc7d}'::uuid[]),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'inflow', 'other_income', 'monthly', date '2026-08-01', null, null, null, true, '{fb089454-1472-453f-bc42-ed962b369162}', '{fb089454-1472-453f-bc42-ed962b369162}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'inflow', 'salary_basic', 'monthly', date '2026-07-01', null, null, null, false, '{6feeb5f5-74ab-4285-bd11-0184bba947f8}', '{6feeb5f5-74ab-4285-bd11-0184bba947f8}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'bnpl_payment', 'monthly', date '2026-08-01', null, null, null, true, '{68a8a284-3d18-4b13-b727-fb2f0049d7d0}', '{68a8a284-3d18-4b13-b727-fb2f0049d7d0}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'dining_out', 'monthly', date '2026-07-01', null, null, null, false, '{7bdbda64-1c60-4bbf-aae6-094248552a00}', '{7bdbda64-1c60-4bbf-aae6-094248552a00}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'donations', 'monthly', date '2026-07-01', null, null, null, false, '{aa18e74a-cc9b-4d87-ac52-d815ae5fbcd4}', '{aa18e74a-cc9b-4d87-ac52-d815ae5fbcd4}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'fitness', 'monthly', date '2026-07-01', null, null, null, false, '{312b7d2d-e1d4-428f-b782-2b8d43f72285}', '{312b7d2d-e1d4-428f-b782-2b8d43f72285}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'groceries', 'monthly', date '2026-07-01', null, null, null, false, '{f560e861-124e-4692-bc6c-e88dfceec52f}', '{f560e861-124e-4692-bc6c-e88dfceec52f}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'health_medical', 'monthly', date '2026-08-01', null, null, null, false, '{a2d2a69c-dbe0-4c90-bde0-d2603e4ef93b}', '{a2d2a69c-dbe0-4c90-bde0-d2603e4ef93b}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'parents_allowance', 'monthly', date '2026-08-01', null, null, null, false, '{646c775c-a838-438a-8b3c-e12345fb9a97}', '{646c775c-a838-438a-8b3c-e12345fb9a97}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'parents_allowance', 'monthly', date '2026-08-01', null, null, null, false, '{c02a9bcc-2a0d-4f70-adc9-deaa6f894ffd}', '{c02a9bcc-2a0d-4f70-adc9-deaa6f894ffd}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'personal_care', 'monthly', date '2026-07-01', null, null, null, false, '{e5ad549b-f69f-44b0-9939-c10401fe4e17}', '{e5ad549b-f69f-44b0-9939-c10401fe4e17}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'pet_care', 'monthly', date '2026-08-01', null, null, null, false, '{f6f13e16-5b80-4103-9cc3-e01eccaaef00}', '{f6f13e16-5b80-4103-9cc3-e01eccaaef00}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'public_transport_ehailing', 'monthly', date '2026-07-01', null, null, null, false, '{ff73cd2b-83bc-4166-a8de-6fc316710f1c}', '{ff73cd2b-83bc-4166-a8de-6fc316710f1c}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'public_transport_ehailing', 'monthly', date '2026-08-01', null, null, null, false, '{041aad4c-79c6-4b63-af53-0c17bcc4b62f}', '{041aad4c-79c6-4b63-af53-0c17bcc4b62f}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'subscriptions', 'monthly', date '2026-08-01', null, null, null, false, '{6f56e470-0010-46ef-a5f0-3fbabde04679}', '{6f56e470-0010-46ef-a5f0-3fbabde04679}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'subscriptions', 'monthly', date '2026-08-01', null, null, null, false, '{07003510-6525-4d7c-8bf0-3d2bfcc53a1c}', '{07003510-6525-4d7c-8bf0-3d2bfcc53a1c}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'telco', 'monthly', date '2026-08-01', null, null, null, false, '{a72d7521-654b-4b5a-8cdc-038ac94d21fa}', '{a72d7521-654b-4b5a-8cdc-038ac94d21fa}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'travel', 'annual', date '2026-07-01', null, null, null, true, '{5f20f738-3381-4b3d-9ee5-cc943669b09a}', '{5f20f738-3381-4b3d-9ee5-cc943669b09a}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'utilities', 'monthly', date '2026-08-01', null, null, null, false, '{49601216-995b-4ea5-8552-88d6ecc36989}', '{49601216-995b-4ea5-8552-88d6ecc36989}'),
  ('04b4faec-78b8-4014-81bf-f3227b757c4f', 'outflow', 'utilities', 'monthly', date '2026-07-01', null, null, null, false, '{368694bb-5516-47ac-b36f-7a029e36f92b}', '{368694bb-5516-47ac-b36f-7a029e36f92b}'),
  ('3ac1e65a-b9db-40f6-9b63-a6e9713febad', 'inflow', 'salary_basic', 'monthly', date '2026-08-01', null, null, null, false, '{fcbcabca-4a2d-4007-8cf7-687747cd1137}', '{fcbcabca-4a2d-4007-8cf7-687747cd1137}'),
  ('3ac1e65a-b9db-40f6-9b63-a6e9713febad', 'outflow', 'dining_out', 'monthly', date '2026-08-01', null, null, null, false, '{a82e080d-f7f6-4d1d-8ff8-c0a6badee541}', '{a82e080d-f7f6-4d1d-8ff8-c0a6badee541}'),
  ('3ac1e65a-b9db-40f6-9b63-a6e9713febad', 'outflow', 'fuel', 'monthly', date '2026-08-01', null, null, null, false, '{73bf6070-536c-4923-96e2-d74ea1b29cdb}', '{73bf6070-536c-4923-96e2-d74ea1b29cdb}'),
  ('3ac1e65a-b9db-40f6-9b63-a6e9713febad', 'outflow', 'groceries', 'monthly', date '2026-08-01', null, null, null, false, '{5bda8f9e-cdc1-4d01-b76e-6b6befb156e7}', '{5bda8f9e-cdc1-4d01-b76e-6b6befb156e7}'),
  ('3ac1e65a-b9db-40f6-9b63-a6e9713febad', 'outflow', 'personal_care', 'monthly', date '2026-08-01', null, null, null, false, '{fe0dfdec-d6cd-43e5-a6e8-71852dca0ffc}', '{fe0dfdec-d6cd-43e5-a6e8-71852dca0ffc}'),
  ('3ac1e65a-b9db-40f6-9b63-a6e9713febad', 'outflow', 'school_fees', 'monthly', date '2026-08-01', null, null, null, false, '{5e3bc2b1-a762-44fd-965a-2e9691a9711a}', '{5e3bc2b1-a762-44fd-965a-2e9691a9711a}'),
  ('3ac1e65a-b9db-40f6-9b63-a6e9713febad', 'outflow', 'telco', 'monthly', date '2026-08-01', null, null, null, false, '{572d306e-164e-4fc1-9a07-b6cce32b1ed6}', '{572d306e-164e-4fc1-9a07-b6cce32b1ed6}'),
  ('3ac1e65a-b9db-40f6-9b63-a6e9713febad', 'outflow', 'toll_parking', 'monthly', date '2026-08-01', null, null, null, false, '{16a4617e-b086-461e-ac2e-1a29d618a5bb}', '{16a4617e-b086-461e-ac2e-1a29d618a5bb}'),
  ('3ac1e65a-b9db-40f6-9b63-a6e9713febad', 'outflow', 'utilities', 'monthly', date '2026-08-01', null, null, null, false, '{a5d650d8-6568-4b02-8e0c-982db6ad39b1}', '{a5d650d8-6568-4b02-8e0c-982db6ad39b1}'),
  ('48dd0e79-8fa5-417a-95b3-1154b3b9c18f', 'inflow', 'bonus', 'annual', date '2026-03-01', null, null, null, false, '{ecceba83-b898-4753-a5ad-ae840203fac6}', '{ecceba83-b898-4753-a5ad-ae840203fac6}'),
  ('48dd0e79-8fa5-417a-95b3-1154b3b9c18f', 'inflow', 'salary_basic', 'monthly', date '2026-03-01', null, null, null, false, '{ccc96357-4007-4fa4-8e99-62e29e253439}', '{ccc96357-4007-4fa4-8e99-62e29e253439}'),
  ('48dd0e79-8fa5-417a-95b3-1154b3b9c18f', 'outflow', 'lifestyle_other', 'monthly', date '2026-03-01', null, null, null, false, '{07a8c944-ae4b-4f38-8a4e-9b10aaecf49e}', '{07a8c944-ae4b-4f38-8a4e-9b10aaecf49e}'),
  ('48dd0e79-8fa5-417a-95b3-1154b3b9c18f', 'outflow', 'living_other', 'monthly', date '2026-03-01', null, null, null, false, '{807432eb-a9d5-4fec-af6d-04bbef4dcd9e}', '{807432eb-a9d5-4fec-af6d-04bbef4dcd9e}'),
  ('48dd0e79-8fa5-417a-95b3-1154b3b9c18f', 'outflow', 'other_expense', 'monthly', date '2026-03-01', null, null, null, false, '{d6540288-f4d8-4d00-bd39-01763ee251dd}', '{d6540288-f4d8-4d00-bd39-01763ee251dd}'),
  ('48dd0e79-8fa5-417a-95b3-1154b3b9c18f', 'outflow', 'transport_other', 'monthly', date '2026-03-01', null, null, null, false, '{5a041f1f-2ce5-4fb3-94b6-0141b9e8adc4}', '{5a041f1f-2ce5-4fb3-94b6-0141b9e8adc4}'),
  ('b023b235-c713-44db-a552-ab02629a4f0c', 'inflow', 'salary_basic', 'monthly', date '2026-06-01', null, null, null, false, '{40e57377-bb0e-4cb8-80c9-f0d8d80ab359}', '{40e57377-bb0e-4cb8-80c9-f0d8d80ab359}'),
  ('b023b235-c713-44db-a552-ab02629a4f0c', 'outflow', 'dining_out', 'monthly', date '2026-06-01', null, null, null, false, '{2e2141c9-4287-4c25-a754-bdf299ede2c8}', '{2e2141c9-4287-4c25-a754-bdf299ede2c8}'),
  ('b023b235-c713-44db-a552-ab02629a4f0c', 'outflow', 'health_medical', 'monthly', date '2026-06-01', null, null, null, false, '{ba6fa76a-991c-44e9-b048-f772e343c7c8}', '{ba6fa76a-991c-44e9-b048-f772e343c7c8}'),
  ('b023b235-c713-44db-a552-ab02629a4f0c', 'outflow', 'personal_care', 'monthly', date '2026-06-01', null, null, null, false, '{e62cd4d3-2732-43ae-9772-0d58bd013b82}', '{e62cd4d3-2732-43ae-9772-0d58bd013b82}'),
  ('b023b235-c713-44db-a552-ab02629a4f0c', 'outflow', 'school_fees', 'monthly', date '2026-06-01', null, null, null, false, '{f0c1bdd6-249a-4c3b-bbe2-5559749573e8}', '{f0c1bdd6-249a-4c3b-bbe2-5559749573e8}'),
  ('b023b235-c713-44db-a552-ab02629a4f0c', 'outflow', 'telco', 'monthly', date '2026-07-01', null, null, null, false, '{97d04dd8-972a-4d47-8619-62ebbce02964}', '{97d04dd8-972a-4d47-8619-62ebbce02964}'),
  ('b023b235-c713-44db-a552-ab02629a4f0c', 'outflow', 'transport_other', 'monthly', date '2026-06-01', null, null, null, false, '{1237db0a-a7ca-48a4-b5ec-4504c0ce6a9e}', '{1237db0a-a7ca-48a4-b5ec-4504c0ce6a9e}'),
  ('bda1a52f-9d6e-467d-a590-d7392ad75866', 'inflow', 'salary_basic', 'monthly', date '2026-07-01', null, null, null, false, '{effe139b-f49a-4633-a98a-0602b891425a}', '{effe139b-f49a-4633-a98a-0602b891425a}'),
  ('bda1a52f-9d6e-467d-a590-d7392ad75866', 'outflow', 'living_other', 'monthly', date '2026-07-01', null, null, null, false, '{90a1a9a4-2054-4f27-9bec-0d59a9b5e186}', '{90a1a9a4-2054-4f27-9bec-0d59a9b5e186}'),
  ('cacf62aa-b037-446a-b285-94e910959566', 'inflow', 'salary_basic', 'monthly', date '2026-07-01', null, null, null, false, '{b144e200-b37f-4977-bb7b-de3ed7c7e02a}', '{b144e200-b37f-4977-bb7b-de3ed7c7e02a}'),
  ('cacf62aa-b037-446a-b285-94e910959566', 'outflow', 'child_expenses', 'monthly', date '2026-07-01', null, null, null, false, '{309af6be-e4cd-45e8-a4cb-30718d8ac8d3}', '{309af6be-e4cd-45e8-a4cb-30718d8ac8d3}'),
  ('cacf62aa-b037-446a-b285-94e910959566', 'outflow', 'lifestyle_other', 'monthly', date '2026-07-01', null, null, null, false, '{2800dd8a-2b14-44fa-ab8a-431fce908f23}', '{2800dd8a-2b14-44fa-ab8a-431fce908f23}'),
  ('cacf62aa-b037-446a-b285-94e910959566', 'outflow', 'living_other', 'monthly', date '2026-07-01', null, null, null, false, '{3f2fcd18-8ec1-4b6f-8e9c-676b39cc6e34,5aa02277-4c5b-44a5-a604-0c4f328cad53}', '{3f2fcd18-8ec1-4b6f-8e9c-676b39cc6e34,5aa02277-4c5b-44a5-a604-0c4f328cad53}'),
  ('cacf62aa-b037-446a-b285-94e910959566', 'outflow', 'utilities', 'monthly', date '2026-07-01', null, null, null, false, '{7fac9d39-d0b2-458f-af54-fa9a44450920}', '{7fac9d39-d0b2-458f-af54-fa9a44450920}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'inflow', 'bonus', 'annual', date '2026-03-01', null, null, null, false, '{e1c2160e-0746-41f3-acbe-cb419501ea67}', '{e1c2160e-0746-41f3-acbe-cb419501ea67}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'inflow', 'commission', 'monthly', date '2026-04-01', null, null, null, false, '{6bc209be-4b8f-4c8f-8817-d5104639018b}', '{6bc209be-4b8f-4c8f-8817-d5104639018b}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'inflow', 'director_fee', 'monthly', date '2026-04-01', null, null, null, false, '{6432c1f2-5ff6-4e5b-b5de-896a874f422e}', '{6432c1f2-5ff6-4e5b-b5de-896a874f422e}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'inflow', 'dividend_company', 'monthly', date '2026-04-01', null, null, null, false, '{cf0fb6e8-a724-45c3-b3cd-69e6980132f6}', '{cf0fb6e8-a724-45c3-b3cd-69e6980132f6}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'inflow', 'dividend_investment', 'monthly', date '2026-04-01', null, null, null, false, '{38052c85-9c4b-47b1-8ad5-96c3d5e166ef}', '{38052c85-9c4b-47b1-8ad5-96c3d5e166ef}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'inflow', 'rental_income', 'monthly', date '2026-04-01', null, null, null, false, '{ae43b9d1-086f-4a44-b80d-8220671c756e}', '{ae43b9d1-086f-4a44-b80d-8220671c756e}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'inflow', 'salary_basic', 'monthly', date '2026-04-01', null, null, null, false, '{010d96d6-d6d3-404b-994c-206bbc04e227}', '{010d96d6-d6d3-404b-994c-206bbc04e227}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'outflow', 'car_installment', 'monthly', date '2026-04-01', null, null, null, true, '{7a26bb77-d4fd-4751-8919-41b5d91e82da}', '{7a26bb77-d4fd-4751-8919-41b5d91e82da}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'outflow', 'dining_out', 'monthly', date '2026-04-01', null, null, null, true, '{6e2636d6-d8ad-42f9-91a8-8b53cc393021}', '{6e2636d6-d8ad-42f9-91a8-8b53cc393021}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'outflow', 'fitness', 'monthly', date '2026-04-01', null, null, null, false, '{9d1fdef1-41a7-4c8e-9e53-02e8bc47bd91}', '{9d1fdef1-41a7-4c8e-9e53-02e8bc47bd91}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'outflow', 'parents_allowance', 'monthly', date '2026-04-01', null, null, null, false, '{2239d5c0-b219-4bb9-89e1-163f1c68822e}', '{2239d5c0-b219-4bb9-89e1-163f1c68822e}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'outflow', 'subscriptions', 'monthly', date '2026-04-01', null, null, null, false, '{630b3dcd-64bc-48e2-a97d-c3ec29201db5}', '{630b3dcd-64bc-48e2-a97d-c3ec29201db5}'),
  ('d5599da9-8920-47fb-81d5-7d0a43fdd08e', 'outflow', 'utilities', 'monthly', date '2026-04-01', null, null, null, true, '{d17806fb-55e2-40f7-a00f-d6a7e3e9a120}', '{d17806fb-55e2-40f7-a00f-d6a7e3e9a120}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'inflow', 'bonus', 'annual', date '2026-03-01', null, null, null, false, '{6c052518-3578-4cf7-b53b-81cd582be506}', '{6c052518-3578-4cf7-b53b-81cd582be506}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'inflow', 'dividend_company', 'monthly', date '2026-03-01', null, null, null, false, '{5453aef3-9346-46dc-a71c-ec6f9de39df5}', '{5453aef3-9346-46dc-a71c-ec6f9de39df5}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'inflow', 'dividend_company', 'monthly', date '2026-03-01', null, null, null, false, '{564edbd2-498e-453f-9b92-d1d87de97fdb}', '{564edbd2-498e-453f-9b92-d1d87de97fdb}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'inflow', 'salary_basic', 'monthly', date '2026-03-01', null, null, null, false, '{94e9c4a8-eec3-48d6-8b00-2f8402cf884d}', '{94e9c4a8-eec3-48d6-8b00-2f8402cf884d}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'car_service_repair', 'monthly', date '2026-03-01', null, null, null, false, '{33c7a65f-6659-488c-b2a5-e6bc323f2fdd}', '{33c7a65f-6659-488c-b2a5-e6bc323f2fdd}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'debt_other', 'monthly', date '2026-03-01', null, null, null, true, '{1ad79787-94c6-42a4-a66b-0c4678a7cc17}', '{1ad79787-94c6-42a4-a66b-0c4678a7cc17}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'dining_out', 'monthly', date '2026-03-01', null, null, null, false, '{645ed026-d7f7-45ef-9895-4f7a5938f414}', '{645ed026-d7f7-45ef-9895-4f7a5938f414}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'donations', 'monthly', date '2026-03-01', null, null, null, false, '{f8b093f3-7abf-4d72-a1d6-649da904abe8}', '{f8b093f3-7abf-4d72-a1d6-649da904abe8}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'entertainment', 'monthly', date '2026-03-01', null, null, null, false, '{74f9fa4a-c3b3-4831-873e-958a61411b81}', '{74f9fa4a-c3b3-4831-873e-958a61411b81}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'fuel', 'monthly', date '2026-03-01', null, null, null, false, '{ff4f68d5-f4e0-4d80-824a-d8b836fb7c42}', '{ff4f68d5-f4e0-4d80-824a-d8b836fb7c42}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'living_other', 'monthly', date '2026-03-01', null, null, null, false, '{90370d11-5718-4596-a5f5-15b637297122}', '{90370d11-5718-4596-a5f5-15b637297122}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'motor_insurance', 'monthly', date '2026-03-01', null, null, null, false, '{0226e928-fa87-46b4-a0b9-c02c4bcb4323}', '{0226e928-fa87-46b4-a0b9-c02c4bcb4323}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'other_expense', 'monthly', date '2026-03-01', null, null, null, false, '{d0cb91c9-9f94-4731-b47f-b96b01b937a9}', '{d0cb91c9-9f94-4731-b47f-b96b01b937a9}'),
  ('e4d43bcd-93e8-45b8-b7d6-6b03d8781233', 'outflow', 'road_tax', 'monthly', date '2026-03-01', null, null, null, false, '{79a48b81-ff33-4310-80ec-d8d6a240e5ae}', '{79a48b81-ff33-4310-80ec-d8d6a240e5ae}')
) as v(client_id, direction, category, frequency, effective_from, effective_to, linked_asset_id, linked_liability_id, needs_review, amount_ids, source_ids);

do $$
declare
  v_migrated bigint;
begin
  select count(*) into v_migrated from public.cashflow_items where source = 'migrated';
  if v_migrated <> 77 then
    raise exception 'expected % migrated cashflow_items row(s), found %', 77, v_migrated;
  end if;
end $$;

