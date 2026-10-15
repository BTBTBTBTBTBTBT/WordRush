-- Holiday morning greetings (founder 10-15: every actual holiday gets its own early branded 'Happy …' post with a custom ChatGPT image).
begin;
insert into public.social_posts (id, title, kind, scheduled_at, hashtags, media, link_target, paused, created_by) values ('924b4d11-9028-5ad2-912f-6dcd0796fa2c', 'Happy Halloween (morning greeting) (image coming)', 'season', '2026-10-31 07:00:00 America/Chicago'::timestamptz, '{halloween,wordocious}'::text[], '[]'::jsonb, 'https://wordocious.com/', true, 'claude') on conflict (id) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-0796fa2c-x', 'https://wordocious.com/', 'x') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('924b4d11-9028-5ad2-912f-6dcd0796fa2c', 'x', 'Happy Halloween from the whole cast.

Costumes on, boards haunted, candy optional. Today''s puzzles are dressed for the night.', 'p-0796fa2c-x') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-0796fa2c-threads', 'https://wordocious.com/', 'threads') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('924b4d11-9028-5ad2-912f-6dcd0796fa2c', 'threads', 'Happy Halloween from the whole cast.

Costumes on, boards haunted, candy optional. Every daily is dressed for the night, so pick a game and tell us which costume won.', 'p-0796fa2c-threads') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-0796fa2c-instagram', 'https://wordocious.com/', 'instagram') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('924b4d11-9028-5ad2-912f-6dcd0796fa2c', 'instagram', 'Happy Halloween from the whole cast.

Costumes on, boards haunted, candy optional. Every daily is dressed up for the night, and the cast picked their costumes weeks ago.

Who wore it best? Tell us below.

Play free: link in bio.', 'p-0796fa2c-instagram') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-0796fa2c-facebook', 'https://wordocious.com/', 'facebook') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('924b4d11-9028-5ad2-912f-6dcd0796fa2c', 'facebook', 'Happy Halloween from the whole Wordocious cast.

Costumes on, boards haunted, candy optional. Every daily is dressed up for the night. Grab the family, pick a game and see who survives the scoreboard.', 'p-0796fa2c-facebook') on conflict (post_id, platform) do nothing;
insert into public.social_posts (id, title, kind, scheduled_at, hashtags, media, link_target, paused, created_by) values ('cd3e9e84-500c-5f93-a35d-736cb74ca3bd', 'Feliz Día de los Muertos (morning greeting) (image coming)', 'season', '2026-11-02 07:00:00 America/Chicago'::timestamptz, '{diadelosmuertos,wordocious}'::text[], '[]'::jsonb, 'https://wordocious.com/', true, 'claude') on conflict (id) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-b74ca3bd-x', 'https://wordocious.com/', 'x') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('cd3e9e84-500c-5f93-a35d-736cb74ca3bd', 'x', 'Feliz Día de los Muertos.

Today we remember the people who taught us to love a good word game, and the ones who always won.', 'p-b74ca3bd-x') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-b74ca3bd-threads', 'https://wordocious.com/', 'threads') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('cd3e9e84-500c-5f93-a35d-736cb74ca3bd', 'threads', 'Feliz Día de los Muertos.

Today we remember the people who taught us to love a good word game, and the ones who always won. Who taught you to play?', 'p-b74ca3bd-threads') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-b74ca3bd-instagram', 'https://wordocious.com/', 'instagram') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('cd3e9e84-500c-5f93-a35d-736cb74ca3bd', 'instagram', 'Feliz Día de los Muertos.

Today we remember the people who taught us to love a good word game, and the ones who always seemed to win.

Who taught you to play? Tell us about them below.', 'p-b74ca3bd-instagram') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-b74ca3bd-facebook', 'https://wordocious.com/', 'facebook') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('cd3e9e84-500c-5f93-a35d-736cb74ca3bd', 'facebook', 'Feliz Día de los Muertos.

Today we remember the people who taught us to love a good word game, and the ones who always seemed to win. Who taught you to play?', 'p-b74ca3bd-facebook') on conflict (post_id, platform) do nothing;
insert into public.social_posts (id, title, kind, scheduled_at, hashtags, media, link_target, paused, created_by) values ('634ccd7e-9daf-50c1-8712-cf96c3ef93cc', 'Happy Diwali (morning greeting) (image coming)', 'season', '2026-11-08 07:00:00 America/Chicago'::timestamptz, '{diwali,wordocious}'::text[], '[]'::jsonb, 'https://wordocious.com/', true, 'claude') on conflict (id) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-c3ef93cc-x', 'https://wordocious.com/', 'x') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('634ccd7e-9daf-50c1-8712-cf96c3ef93cc', 'x', 'Happy Diwali from all of us at Wordocious.

Wishing you light, family and a little friendly competition.', 'p-c3ef93cc-x') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-c3ef93cc-threads', 'https://wordocious.com/', 'threads') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('634ccd7e-9daf-50c1-8712-cf96c3ef93cc', 'threads', 'Happy Diwali from all of us at Wordocious.

Wishing you light, family, sweets and a little friendly competition around the table.', 'p-c3ef93cc-threads') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-c3ef93cc-instagram', 'https://wordocious.com/', 'instagram') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('634ccd7e-9daf-50c1-8712-cf96c3ef93cc', 'instagram', 'Happy Diwali from all of us at Wordocious.

Wishing you light, family, sweets and a little friendly competition around the table.

Play free: link in bio.', 'p-c3ef93cc-instagram') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-c3ef93cc-facebook', 'https://wordocious.com/', 'facebook') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('634ccd7e-9daf-50c1-8712-cf96c3ef93cc', 'facebook', 'Happy Diwali from all of us at Wordocious.

Wishing you and your family light, sweets and a little friendly competition around the table.', 'p-c3ef93cc-facebook') on conflict (post_id, platform) do nothing;
insert into public.social_posts (id, title, kind, scheduled_at, hashtags, media, link_target, paused, created_by) values ('e0490c43-5433-59b3-b680-1e1e125420f9', 'Veterans Day (morning greeting) (image coming)', 'season', '2026-11-11 07:00:00 America/Chicago'::timestamptz, '{veteransday,wordocious}'::text[], '[]'::jsonb, 'https://wordocious.com/', true, 'claude') on conflict (id) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-125420f9-x', 'https://wordocious.com/', 'x') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('e0490c43-5433-59b3-b680-1e1e125420f9', 'x', 'Happy Veterans Day.

Thank you to everyone who served, and to the families who served alongside them.', 'p-125420f9-x') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-125420f9-threads', 'https://wordocious.com/', 'threads') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('e0490c43-5433-59b3-b680-1e1e125420f9', 'threads', 'Happy Veterans Day.

Thank you to everyone who served, and to the families who served alongside them. We are grateful today and every day.', 'p-125420f9-threads') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-125420f9-instagram', 'https://wordocious.com/', 'instagram') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('e0490c43-5433-59b3-b680-1e1e125420f9', 'instagram', 'Happy Veterans Day.

Thank you to everyone who served, and to the families who served alongside them. We are grateful today and every day.', 'p-125420f9-instagram') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-125420f9-facebook', 'https://wordocious.com/', 'facebook') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('e0490c43-5433-59b3-b680-1e1e125420f9', 'facebook', 'Happy Veterans Day.

Thank you to everyone who served, and to the families who served alongside them. We are grateful today and every day.', 'p-125420f9-facebook') on conflict (post_id, platform) do nothing;
insert into public.social_posts (id, title, kind, scheduled_at, hashtags, media, link_target, paused, created_by) values ('95fe3bfd-e064-58e8-a1fa-07780560161e', 'Happy Thanksgiving (morning greeting) (image coming)', 'season', '2026-11-26 07:00:00 America/Chicago'::timestamptz, '{thanksgiving,wordocious}'::text[], '[]'::jsonb, 'https://wordocious.com/', true, 'claude') on conflict (id) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-0560161e-x', 'https://wordocious.com/', 'x') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('95fe3bfd-e064-58e8-a1fa-07780560161e', 'x', 'Happy Thanksgiving from the whole cast.

We''re grateful you play with us. Save room for pie, and one more round.', 'p-0560161e-x') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-0560161e-threads', 'https://wordocious.com/', 'threads') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('95fe3bfd-e064-58e8-a1fa-07780560161e', 'threads', 'Happy Thanksgiving from the whole cast.

We''re grateful you play with us. Save room for pie, and save one more round for after.', 'p-0560161e-threads') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-0560161e-instagram', 'https://wordocious.com/', 'instagram') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('95fe3bfd-e064-58e8-a1fa-07780560161e', 'instagram', 'Happy Thanksgiving from the whole cast.

We''re grateful you play with us. Save room for pie, and save one more round for after.

Play free: link in bio.', 'p-0560161e-instagram') on conflict (post_id, platform) do nothing;
insert into public.marketing_links (slug, target, channel) values ('p-0560161e-facebook', 'https://wordocious.com/', 'facebook') on conflict (slug) do nothing;
insert into public.social_post_targets (post_id, platform, caption, link_slug) values ('95fe3bfd-e064-58e8-a1fa-07780560161e', 'facebook', 'Happy Thanksgiving from the whole Wordocious cast.

We''re grateful you play with us. Save room for pie, and save one more round for after dinner.', 'p-0560161e-facebook') on conflict (post_id, platform) do nothing;
commit;
