-- GENERATED FILE — review before applying.
-- Source: scripts/build-legacy-remap.ts over a snapshot of cashflow_entries and assets.
-- Spec 附录 A. Needs 20260923000001/000002 committed first (new enum values, new codes).

-- 0. Keep the pre-remap rows. The archive schema is not exposed through the API.
create schema if not exists archive;
revoke all on schema archive from anon, authenticated;
create table if not exists archive.cashflow_entries_20260923 as table public.cashflow_entries;
create table if not exists archive.assets_20260923 as table public.assets;
alter table archive.cashflow_entries_20260923 enable row level security;
alter table archive.assets_20260923 enable row level security;

-- 1. Cash-flow rows from the snapshot. The `and category = …` guard turns an
--    update into a no-op if the row was edited after the snapshot.
update public.cashflow_entries set category = 'salary_basic', needs_review = false, review_reason = null where id = '010d96d6-d6d3-404b-994c-206bbc04e227' and category = 'salary';
update public.cashflow_entries set category = 'motor_insurance', needs_review = false, review_reason = null where id = '0226e928-fa87-46b4-a0b9-c02c4bcb4323' and category = 'transportation';
update public.cashflow_entries set category = 'public_transport_ehailing', needs_review = false, review_reason = null where id = '041aad4c-79c6-4b63-af53-0c17bcc4b62f' and category = 'transportation';
update public.cashflow_entries set category = 'subscriptions', needs_review = false, review_reason = null where id = '07003510-6525-4d7c-8bf0-3d2bfcc53a1c' and category = 'personal';
update public.cashflow_entries set category = 'lifestyle_other', needs_review = false, review_reason = null where id = '07a8c944-ae4b-4f38-8a4e-9b10aaecf49e' and category = 'personal';
update public.cashflow_entries set category = 'transport_other', needs_review = false, review_reason = null where id = '1237db0a-a7ca-48a4-b5ec-4504c0ce6a9e' and category = 'transportation';
update public.cashflow_entries set category = 'toll_parking', needs_review = false, review_reason = null where id = '16a4617e-b086-461e-ac2e-1a29d618a5bb' and category = 'transportation';
update public.cashflow_entries set category = 'debt_other', needs_review = true, review_reason = '还款行：第二阶段会由负债自动生成月供，届时去重' where id = '1ad79787-94c6-42a4-a66b-0c4678a7cc17' and category = 'loan_repayment';
update public.cashflow_entries set category = 'parents_allowance', needs_review = false, review_reason = null where id = '2239d5c0-b219-4bb9-89e1-163f1c68822e' and category = 'dependants';
update public.cashflow_entries set category = 'lifestyle_other', needs_review = false, review_reason = null where id = '2800dd8a-2b14-44fa-ab8a-431fce908f23' and category = 'personal';
update public.cashflow_entries set category = 'dining_out', needs_review = false, review_reason = null where id = '2e2141c9-4287-4c25-a754-bdf299ede2c8' and category = 'personal';
update public.cashflow_entries set category = 'child_expenses', needs_review = false, review_reason = null where id = '309af6be-e4cd-45e8-a4cb-30718d8ac8d3' and category = 'dependants';
update public.cashflow_entries set category = 'fitness', needs_review = false, review_reason = null where id = '312b7d2d-e1d4-428f-b782-2b8d43f72285' and category = 'personal';
update public.cashflow_entries set category = 'car_service_repair', needs_review = false, review_reason = null where id = '33c7a65f-6659-488c-b2a5-e6bc323f2fdd' and category = 'transportation';
update public.cashflow_entries set category = 'utilities', needs_review = false, review_reason = null where id = '368694bb-5516-47ac-b36f-7a029e36f92b' and category = 'household';
update public.cashflow_entries set category = 'dividend_investment', needs_review = false, review_reason = null where id = '38052c85-9c4b-47b1-8ad5-96c3d5e166ef' and category = 'investment_return';
update public.cashflow_entries set category = 'living_other', needs_review = false, review_reason = null where id = '3f2fcd18-8ec1-4b6f-8e9c-676b39cc6e34' and category = 'household';
update public.cashflow_entries set category = 'salary_basic', needs_review = false, review_reason = null where id = '40e57377-bb0e-4cb8-80c9-f0d8d80ab359' and category = 'salary';
update public.cashflow_entries set category = 'utilities', needs_review = false, review_reason = null where id = '49601216-995b-4ea5-8552-88d6ecc36989' and category = 'household';
update public.cashflow_entries set category = 'dividend_company', needs_review = false, review_reason = null where id = '5453aef3-9346-46dc-a71c-ec6f9de39df5' and category = 'dividend';
update public.cashflow_entries set category = 'dividend_company', needs_review = false, review_reason = null where id = '564edbd2-498e-453f-9b92-d1d87de97fdb' and category = 'dividend';
update public.cashflow_entries set category = 'telco', needs_review = false, review_reason = null where id = '572d306e-164e-4fc1-9a07-b6cce32b1ed6' and category = 'household';
update public.cashflow_entries set category = 'transport_other', needs_review = false, review_reason = null where id = '5a041f1f-2ce5-4fb3-94b6-0141b9e8adc4' and category = 'transportation';
update public.cashflow_entries set category = 'living_other', needs_review = false, review_reason = null where id = '5aa02277-4c5b-44a5-a604-0c4f328cad53' and category = 'household';
update public.cashflow_entries set category = 'groceries', needs_review = false, review_reason = null where id = '5bda8f9e-cdc1-4d01-b76e-6b6befb156e7' and category = 'household';
update public.cashflow_entries set category = 'school_fees', needs_review = false, review_reason = null where id = '5e3bc2b1-a762-44fd-965a-2e9691a9711a' and category = 'dependants';
update public.cashflow_entries set category = 'travel', needs_review = true, review_reason = 'KYC 中该项按年填写，已改为按年', frequency = 'annual' where id = '5f20f738-3381-4b3d-9ee5-cc943669b09a' and category = 'personal';
update public.cashflow_entries set category = 'subscriptions', needs_review = false, review_reason = null where id = '630b3dcd-64bc-48e2-a97d-c3ec29201db5' and category = 'other_expense';
update public.cashflow_entries set category = 'dining_out', needs_review = false, review_reason = null where id = '645ed026-d7f7-45ef-9895-4f7a5938f414' and category = 'personal';
update public.cashflow_entries set category = 'parents_allowance', needs_review = false, review_reason = null where id = '646c775c-a838-438a-8b3c-e12345fb9a97' and category = 'dependants';
update public.cashflow_entries set category = 'bnpl_payment', needs_review = true, review_reason = '还款行：第二阶段会由负债自动生成月供，届时去重' where id = '68a8a284-3d18-4b13-b727-fb2f0049d7d0' and category = 'personal';
update public.cashflow_entries set category = 'dining_out', needs_review = true, review_reason = '一行包含多个项目，请拆分后分别归类' where id = '6e2636d6-d8ad-42f9-91a8-8b53cc393021' and category = 'miscellaneous';
update public.cashflow_entries set category = 'subscriptions', needs_review = false, review_reason = null where id = '6f56e470-0010-46ef-a5f0-3fbabde04679' and category = 'personal';
update public.cashflow_entries set category = 'salary_basic', needs_review = false, review_reason = null where id = '6feeb5f5-74ab-4285-bd11-0184bba947f8' and category = 'salary';
update public.cashflow_entries set category = 'fuel', needs_review = false, review_reason = null where id = '73bf6070-536c-4923-96e2-d74ea1b29cdb' and category = 'transportation';
update public.cashflow_entries set category = 'entertainment', needs_review = false, review_reason = null where id = '74f9fa4a-c3b3-4831-873e-958a61411b81' and category = 'personal';
update public.cashflow_entries set category = 'road_tax', needs_review = false, review_reason = null where id = '79a48b81-ff33-4310-80ec-d8d6a240e5ae' and category = 'transportation';
update public.cashflow_entries set category = 'car_installment', needs_review = true, review_reason = '一行包含多个项目，请拆分后分别归类；还款行：第二阶段会由负债自动生成月供，届时去重' where id = '7a26bb77-d4fd-4751-8919-41b5d91e82da' and category = 'transportation';
update public.cashflow_entries set category = 'dining_out', needs_review = false, review_reason = null where id = '7bdbda64-1c60-4bbf-aae6-094248552a00' and category = 'personal';
update public.cashflow_entries set category = 'utilities', needs_review = false, review_reason = null where id = '7fac9d39-d0b2-458f-af54-fa9a44450920' and category = 'household';
update public.cashflow_entries set category = 'living_other', needs_review = false, review_reason = null where id = '807432eb-a9d5-4fec-af6d-04bbef4dcd9e' and category = 'household';
update public.cashflow_entries set category = 'living_other', needs_review = false, review_reason = null where id = '90370d11-5718-4596-a5f5-15b637297122' and category = 'household';
update public.cashflow_entries set category = 'living_other', needs_review = false, review_reason = null where id = '90a1a9a4-2054-4f27-9bec-0d59a9b5e186' and category = 'household';
update public.cashflow_entries set category = 'salary_basic', needs_review = false, review_reason = null where id = '94e9c4a8-eec3-48d6-8b00-2f8402cf884d' and category = 'salary';
update public.cashflow_entries set category = 'telco', needs_review = false, review_reason = null where id = '97d04dd8-972a-4d47-8619-62ebbce02964' and category = 'household';
update public.cashflow_entries set category = 'fitness', needs_review = false, review_reason = null where id = '9d1fdef1-41a7-4c8e-9e53-02e8bc47bd91' and category = 'personal';
update public.cashflow_entries set category = 'health_medical', needs_review = false, review_reason = null where id = 'a2d2a69c-dbe0-4c90-bde0-d2603e4ef93b' and category = 'miscellaneous';
update public.cashflow_entries set category = 'utilities', needs_review = false, review_reason = null where id = 'a5d650d8-6568-4b02-8e0c-982db6ad39b1' and category = 'household';
update public.cashflow_entries set category = 'telco', needs_review = false, review_reason = null where id = 'a72d7521-654b-4b5a-8cdc-038ac94d21fa' and category = 'household';
update public.cashflow_entries set category = 'dining_out', needs_review = false, review_reason = null where id = 'a82e080d-f7f6-4d1d-8ff8-c0a6badee541' and category = 'personal';
update public.cashflow_entries set category = 'donations', needs_review = false, review_reason = null where id = 'aa18e74a-cc9b-4d87-ac52-d815ae5fbcd4' and category = 'personal';
update public.cashflow_entries set category = 'salary_basic', needs_review = false, review_reason = null where id = 'b144e200-b37f-4977-bb7b-de3ed7c7e02a' and category = 'salary';
update public.cashflow_entries set category = 'health_medical', needs_review = false, review_reason = null where id = 'ba6fa76a-991c-44e9-b048-f772e343c7c8' and category = 'miscellaneous';
update public.cashflow_entries set category = 'parents_allowance', needs_review = false, review_reason = null where id = 'c02a9bcc-2a0d-4f70-adc9-deaa6f894ffd' and category = 'household';
update public.cashflow_entries set category = 'salary_basic', needs_review = false, review_reason = null where id = 'ccc96357-4007-4fa4-8e99-62e29e253439' and category = 'salary';
update public.cashflow_entries set category = 'dividend_company', needs_review = false, review_reason = null where id = 'cf0fb6e8-a724-45c3-b3cd-69e6980132f6' and category = 'dividend';
update public.cashflow_entries set category = 'other_expense', needs_review = false, review_reason = null where id = 'd0cb91c9-9f94-4731-b47f-b96b01b937a9' and category = 'miscellaneous';
update public.cashflow_entries set category = 'utilities', needs_review = true, review_reason = '一行包含多个项目，请拆分后分别归类' where id = 'd17806fb-55e2-40f7-a00f-d6a7e3e9a120' and category = 'household';
update public.cashflow_entries set category = 'other_expense', needs_review = false, review_reason = null where id = 'd6540288-f4d8-4d00-bd39-01763ee251dd' and category = 'miscellaneous';
update public.cashflow_entries set category = 'personal_care', needs_review = false, review_reason = null where id = 'e5ad549b-f69f-44b0-9939-c10401fe4e17' and category = 'personal';
update public.cashflow_entries set category = 'personal_care', needs_review = false, review_reason = null where id = 'e62cd4d3-2732-43ae-9772-0d58bd013b82' and category = 'personal';
update public.cashflow_entries set category = 'salary_basic', needs_review = false, review_reason = null where id = 'effe139b-f49a-4633-a98a-0602b891425a' and category = 'salary';
update public.cashflow_entries set category = 'school_fees', needs_review = false, review_reason = null where id = 'f0c1bdd6-249a-4c3b-bbe2-5559749573e8' and category = 'personal';
update public.cashflow_entries set category = 'groceries', needs_review = false, review_reason = null where id = 'f560e861-124e-4692-bc6c-e88dfceec52f' and category = 'household';
update public.cashflow_entries set category = 'pet_care', needs_review = false, review_reason = null where id = 'f6f13e16-5b80-4103-9cc3-e01eccaaef00' and category = 'household';
update public.cashflow_entries set category = 'donations', needs_review = false, review_reason = null where id = 'f8b093f3-7abf-4d72-a1d6-649da904abe8' and category = 'personal';
update public.cashflow_entries set category = 'other_income', needs_review = true, review_reason = '请确认这笔流入是收入，还是资产变现或借款（不算收入）' where id = 'fb089454-1472-453f-bc42-ed962b369162' and category = 'other_income';
update public.cashflow_entries set category = 'salary_basic', needs_review = false, review_reason = null where id = 'fcbcabca-4a2d-4007-8cf7-687747cd1137' and category = 'salary';
update public.cashflow_entries set category = 'personal_care', needs_review = false, review_reason = null where id = 'fe0dfdec-d6cd-43e5-a6e8-71852dca0ffc' and category = 'personal';
update public.cashflow_entries set category = 'fuel', needs_review = false, review_reason = null where id = 'ff4f68d5-f4e0-4d80-824a-d8b836fb7c42' and category = 'transportation';
update public.cashflow_entries set category = 'public_transport_ehailing', needs_review = false, review_reason = null where id = 'ff73cd2b-83bc-4166-a8de-6fc316710f1c' and category = 'transportation';

-- 2. Assets whose type was a guess (property / other).
update public.assets set asset_type = 'gold', needs_review = false, review_reason = null where id = '356975ed-a577-4042-91d4-6485a73b8d80' and asset_type = 'other';
update public.assets set asset_type = 'gold', needs_review = true, review_reason = '名称包含多种资产，请拆分或确认类型' where id = '4a585481-e9a4-49bb-858f-9fb6013c0312' and asset_type = 'other';
update public.assets set asset_type = 'own_residence', needs_review = false, review_reason = null where id = '6ff521c3-00aa-46c6-ae32-14e948cbf8ea' and asset_type = 'property';
update public.assets set asset_type = 'own_residence', needs_review = false, review_reason = null where id = 'b67efe37-039f-4592-ad3e-8c9668164786' and asset_type = 'property';
update public.assets set asset_type = 'own_residence', needs_review = true, review_reason = '请确认这项房产是自住还是投资' where id = 'f262a1fb-d26c-41dc-975a-23b369bce637' and asset_type = 'property';

-- 3. Any legacy code written after the snapshot: plain mapping, flagged.
update public.cashflow_entries set category = 'salary_basic', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'salary';
update public.cashflow_entries set category = 'dividend_company', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'dividend';
update public.cashflow_entries set category = 'dividend_investment', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'investment_return';
update public.cashflow_entries set category = 'living_other', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'household';
update public.cashflow_entries set category = 'transport_other', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'transportation';
update public.cashflow_entries set category = 'family_other', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'dependants';
update public.cashflow_entries set category = 'lifestyle_other', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'personal';
update public.cashflow_entries set category = 'protection_other', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'insurance_premium';
update public.cashflow_entries set category = 'debt_other', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'loan_repayment';
update public.cashflow_entries set category = 'investment_other', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'investment_contribution';
update public.cashflow_entries set category = 'income_tax', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'tax';
update public.cashflow_entries set category = 'housing_other', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'property_expense';
update public.cashflow_entries set category = 'maintenance_fee', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'property_maintenance';
update public.cashflow_entries set category = 'other_expense', needs_review = true, review_reason = '迁移后写入的旧分类，请确认具体分类' where category = 'miscellaneous';

-- 4. Purpose (where unset) and liquidity for every asset, from the taxonomy.
update public.assets set purpose = case asset_type::text when 'stock' then 'investment' when 'etf' then 'investment' when 'unit_trust' then 'investment' when 'reit' then 'income_producing' when 'bond' then 'investment' when 'asnb' then 'investment' when 'tabung_haji' then 'investment' when 'gold' then 'investment' when 'crypto' then 'investment' when 'forex' then 'investment' when 'investment_property' then 'income_producing' when 'land' then 'investment' when 'business' then 'investment' when 'receivable' then 'investment' when 'sspn' then 'investment' when 'other' then 'investment' when 'own_residence' then 'personal_use' when 'vehicle' then 'personal_use' when 'jewelry' then 'personal_use' when 'collectibles' then 'personal_use' when 'personal_asset_other' then 'personal_use' when 'property' then 'personal_use' else null end where purpose is null;
update public.assets set liquidity = (case asset_type::text when 'savings' then 'high' when 'fixed_deposit' then 'high' when 'money_market' then 'high' when 'cash_on_hand' then 'high' when 'ewallet' then 'high' when 'foreign_currency' then 'high' when 'epf_account_1' then 'low' when 'epf_account_2' then 'low' when 'epf_account_3' then 'low' when 'prs' then 'low' when 'stock' then 'medium' when 'etf' then 'medium' when 'unit_trust' then 'medium' when 'reit' then 'medium' when 'bond' then 'low' when 'asnb' then 'medium' when 'tabung_haji' then 'low' when 'gold' then 'low' when 'crypto' then 'low' when 'forex' then 'low' when 'investment_property' then 'low' when 'land' then 'low' when 'business' then 'low' when 'receivable' then 'low' when 'sspn' then 'low' when 'other' then 'low' when 'own_residence' then 'low' when 'vehicle' then 'low' when 'jewelry' then 'low' when 'collectibles' then 'low' when 'personal_asset_other' then 'low' when 'property' then 'low' else 'low' end)::public.liquidity_level;

-- 5. Retire the legacy categories. Rows no longer use them; the FK keeps them.
update public.cashflow_categories set is_active = false where code in ('salary', 'dividend', 'investment_return', 'household', 'transportation', 'dependants', 'personal', 'insurance_premium', 'loan_repayment', 'investment_contribution', 'tax', 'property_expense', 'property_maintenance', 'miscellaneous');
