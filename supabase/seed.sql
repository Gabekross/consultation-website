-- Seed two demo active profiles (MC Finest, MC Haywai)
insert into public.profiles (slug, display_name, hero_headline, hero_subtext, whatsapp_number, notification_emails, owner_user_id, status)
values
  ('mc-finest', 'MC Finest', 'Premium MC services for unforgettable events.', 'High-energy hosting with professional flow, crowd engagement, and clean transitions.', null, '{}', gen_random_uuid(), 'active'),
  ('mc-haywai', 'MC Haywai', 'Elegant hosting with a modern touch.', 'A refined presence for weddings, corporate events, and cultural celebrations.', null, '{}', gen_random_uuid(), 'active')
on conflict (slug) do nothing;
