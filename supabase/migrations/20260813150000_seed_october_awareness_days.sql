-- Verified October awareness days.
--
-- Dates verified against the AVMA's published 2026 awareness calendar and the
-- sponsoring organizations. All rows land verified = true, is_active = true —
-- these are usable entries, unlike the unverified TS port.
--
-- Four names collide with rows ported from lib/social/awareness-days.ts. The
-- ON CONFLICT clause corrects them in place: the port defaulted every null-day
-- entry to month_long, so "Pet Obesity Awareness Day", "National Cat Day" and
-- "Halloween Pet Safety" carried the wrong rule_type. Every rule field is
-- written explicitly (including NULLs) so the rule_type CHECK constraint is
-- satisfied after the update.
--
-- Deliberately excluded: National Pit Bull Awareness Day (sources conflict
-- between the fourth and the last Saturday of October, which differ in 2026 —
-- Oct 24 vs Oct 31 — unresolved against Bless the Bullys); International
-- Shakeout Day and World Food Day (on the AVMA calendar, low relevance to
-- companion-animal practice social content).

insert into public.social_awareness_days
  (name, description, content_angle, rule_type, month,
   day, nth, weekday, week_start_day, duration_days,
   verified, is_active, source_url)
values
  -- ── month_long ─────────────────────────────────────────────────────────────
  ('Adopt a Shelter Dog Month',
   'ASPCA-sponsored month promoting adoption of shelter dogs. American Humane runs the same month as Adopt A Dog Month.',
   'Feature adoptable or adopted patients; partner with a local shelter; share adoption-day photos from clients.',
   'month_long', 10, null, null, null, null, null,
   true, true, 'https://www.aspca.org/adopt/adopt-a-shelter-dog-month'),

  ('National Pet Wellness Month',
   'Established 2004 by the AVMA and Fort Dodge Animal Health to promote preventive care and regular wellness exams.',
   'Strongest service tie-in of the month — wellness exam booking, life-stage care, what a wellness visit includes.',
   'month_long', 10, null, null, null, null, null,
   true, true, 'https://www.avma.org/events/pet-health-and-veterinary-awareness-events'),

  ('National Animal Safety and Protection Month',
   'Month-long focus on animal safety and protection.',
   'Pairs with fall hazards — antifreeze, darker evening walks, reflective gear, holiday foods.',
   'month_long', 10, null, null, null, null, null,
   true, true, 'https://www.avma.org/events/pet-health-and-veterinary-awareness-events'),

  -- ── week_of, fixed-start form (week_start_day set) ─────────────────────────
  ('Walk Your Dog Week',
   'Week encouraging daily dog walking.',
   'Staff-and-their-dogs walk photos; joint health and weight management tie-in.',
   'week_of', 10, null, null, null, 1, 7,
   true, true, 'https://www.avma.org/events/pet-health-and-veterinary-awareness-events'),

  -- ── week_of, nth-weekday-start form (nth + weekday set) ────────────────────
  -- Week beginning the THIRD SUNDAY of October. Resolved at read time by
  -- resolveAwarenessDate(); do not hardcode. Falls on Oct 18-24 in 2026.
  ('National Veterinary Technician Week',
   'NAVTA-designated week honoring credentialed veterinary technicians. Established 1993.',
   'Highest-engagement team content of the year. One tech per day, or one combined feature. Needs a photo and a short quote or fun fact from each tech.',
   'week_of', 10, null, 3, 0, null, 7,
   true, true, 'https://navta.net/national-veterinary-technician-week/'),

  -- ── fixed ──────────────────────────────────────────────────────────────────
  ('World Animal Day',
   'International day for animal welfare.',
   'Broad-appeal engagement post; ask followers to share a pet photo. Low production cost.',
   'fixed', 10, 4, null, null, null, null,
   true, true, 'https://www.avma.org/events/pet-health-and-veterinary-awareness-events'),

  ('Pet Obesity Awareness Day',
   'Observance from the Association for Pet Obesity Prevention. Note: the AVMA lists this as a fixed October 14; some sources describe it as the second Wednesday. Both resolve to Oct 14 in 2026. Stored as fixed per the AVMA.',
   'Body condition scoring explainer, weight management services, healthy treat swaps. Keep the tone supportive, never shaming.',
   'fixed', 10, 14, null, null, null, null,
   true, true, 'https://petobesityprevention.org/'),

  ('Global Cat Day (National Feral Cat Day)',
   'Created by Alley Cat Allies in 2001 as National Feral Cat Day, rebranded Global Cat Day in 2016. Same October 16 observance under both names. Focus is community cats and Trap-Neuter-Return.',
   'TNR education, community cat care, feline patient features. Use only if the practice actually sees community cats.',
   'fixed', 10, 16, null, null, null, null,
   true, true, 'https://globalcatday.org/'),

  ('National Pets for Veterans Day',
   'Observance recognizing service and companion animals for veterans.',
   'Service and companion animals for veterans. Use only with a real local connection — generic posts read as hollow.',
   'fixed', 10, 21, null, null, null, null,
   true, true, 'https://www.avma.org/events/pet-health-and-veterinary-awareness-events'),

  ('Reptile Awareness Day',
   'Awareness day for reptiles and their care.',
   'Only relevant for practices seeing exotics. Skip for dog-and-cat-only clients.',
   'fixed', 10, 21, null, null, null, null,
   true, true, 'https://www.avma.org/events/pet-health-and-veterinary-awareness-events'),

  ('National Cat Day',
   'Celebrates cats and promotes adoption.',
   'High engagement, low effort. Feature feline patients or ask followers to post their cats.',
   'fixed', 10, 29, null, null, null, null,
   true, true, 'https://www.avma.org/events/pet-health-and-veterinary-awareness-events'),

  ('Halloween Pet Safety',
   'Not an animal awareness observance, but the largest October content opportunity for companion-animal practices.',
   'Chocolate and xylitol toxicity, costume fit and comfort, door-dashing during trick-or-treat, candy wrappers as obstruction risk. Also a costume-photo engagement post.',
   'fixed', 10, 31, null, null, null, null,
   true, true, null)

on conflict (name, month) do update set
  description    = excluded.description,
  content_angle  = excluded.content_angle,
  rule_type      = excluded.rule_type,
  day            = excluded.day,
  nth            = excluded.nth,
  weekday        = excluded.weekday,
  week_start_day = excluded.week_start_day,
  duration_days  = excluded.duration_days,
  source_url     = excluded.source_url,
  verified       = true,
  is_active      = true,
  updated_at     = now();
