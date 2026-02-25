-- Permitir a los ADMIN gestionar libremente las tablas core usando la función segura de Clerk
CREATE POLICY "Admins can manage all invoices" ON invoices
FOR ALL TO authenticated USING ( public.get_current_user_role() = 'ADMIN' ) WITH CHECK ( public.get_current_user_role() = 'ADMIN' );

CREATE POLICY "Admins can manage all quotations" ON quotations
FOR ALL TO authenticated USING ( public.get_current_user_role() = 'ADMIN' ) WITH CHECK ( public.get_current_user_role() = 'ADMIN' );

CREATE POLICY "Admins can manage all evidence" ON evidence
FOR ALL TO authenticated USING ( public.get_current_user_role() = 'ADMIN' ) WITH CHECK ( public.get_current_user_role() = 'ADMIN' );

CREATE POLICY "Admins can manage all contracts" ON contracts
FOR ALL TO authenticated USING ( public.get_current_user_role() = 'ADMIN' ) WITH CHECK ( public.get_current_user_role() = 'ADMIN' );

CREATE POLICY "Admins can manage all vendors" ON vendors
FOR ALL TO authenticated USING ( public.get_current_user_role() = 'ADMIN' ) WITH CHECK ( public.get_current_user_role() = 'ADMIN' );
