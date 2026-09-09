-- Drafts for the four services that had no "What this isn't", and glossary
-- terms for the services beyond SEO.
--
-- The gap was visible in a live document: a client on all five services got
-- "What this isn't" under SEO only, and a glossary that explained Map Pack and
-- NAP consistency while saying nothing about Quality Score or reach. Across
-- five sections that reads as an oversight rather than a decision.
--
-- All of this is draft copy to be rewritten in Tom's voice.

insert into public.service_expectation_blocks (block_key, body, sort_order)
values
  ('ppc_limits',
   'Your budget buys clicks, not bookings. What happens after the click depends on your website, your phones, and how enquiries are handled — we will tell you honestly when the ads are working and the conversion is not. Ads are also not permanent: unlike SEO, results stop when the budget does. And the cost of a call is not a fixed rate. It is an auction, so it moves with your competitors and the season, and we will always tell you whether a rising cost is something we can fix or something the market is doing.',
   0),
  ('smm_limits',
   'Social is not a direct sales channel for most practices, and judging it on bookings alone will make good work look like failure. Its job is familiarity — so that when someone needs a vet, yours is the name they already recognise. It is also not a substitute for your own voice: the posts that consistently do best are the ones with your real team and real patients in them, which is the one thing we cannot produce without you. And follower count is not the goal. Reach and engagement among local pet owners are worth far more than a large, distant following.',
   0),
  ('blog_limits',
   'Articles are not immediate traffic. Each one takes weeks to be indexed and months to rank, and the value is cumulative — the library matters far more than any single post. Blogging is also not a replacement for your service pages, which are what people actually search for and where we would always invest first. And we are not the clinical authority: anything medically sensitive comes to you before it publishes, and we would much rather ask than guess.',
   0),
  ('orm_limits',
   'We cannot remove a negative review. Nobody can, unless it breaches Google''s policies, and any service that claims otherwise is selling something that does not work. We also cannot ask for reviews on your behalf in a way that carries any weight — that request has to come from your team, in the room, at the moment of care. What we can do is make asking easy, respond well to everything that arrives, and make sure one bad week does not define your rating.',
   0)
on conflict (block_key) do nothing;

insert into public.expectation_glossary (term, definition, services, sort_order)
values
  ('Landing page',
   'The page someone arrives on after clicking. Sending people to a page about the exact service they searched for converts far better than sending everyone to your homepage.',
   '{seo,ppc}', 200),
  ('Click-through rate (CTR)',
   'The share of people who saw your listing and clicked it. It tells us how appealing your listing looks, separately from how often it appears.',
   '{}', 210),
  ('Impression share',
   'The share of available searches where your ad actually appeared. A low number usually means budget rather than quality — you are eligible to show and simply running out.',
   '{ppc}', 220),
  ('Quality Score',
   'Google''s rating of how relevant your ad and its landing page are to the search. A higher score lowers what you pay for the same position, so it is worth real attention.',
   '{ppc}', 230),
  ('Cost per click (CPC)',
   'What you pay when someone clicks your ad. It is set by auction rather than a fixed rate, so it moves with your competitors and the season.',
   '{ppc}', 240),
  ('Cost per conversion',
   'What you paid for each call or booking, rather than each click. This is the number that says whether the ads are worth running.',
   '{ppc}', 250),
  ('Negative keyword',
   'A search we tell Google not to show you for — "free", "jobs", "dog food" — so budget is not spent on people who were never going to book.',
   '{ppc}', 260),
  ('Learning period',
   'The first weeks of a new campaign, while Google works out who converts. Results swing about during it, and significant changes restart it, which is why we ask for a few weeks before judging.',
   '{ppc}', 270),
  ('Reach',
   'How many people saw a post. Different from your follower count — most posts reach only a fraction of followers, which is normal on every platform.',
   '{smm}', 280),
  ('Engagement',
   'Likes, comments, shares and saves. Beyond being nice to see, it signals to the platform that a post is worth showing to more people.',
   '{smm}', 290),
  ('Organic vs boosted',
   'Organic posts are free and reach a limited slice of your audience. Boosted posts are paid to reach further, and we will always tell you which is which.',
   '{smm}', 300),
  ('Evergreen content',
   'An article that stays useful for years — what to do if your dog eats chocolate — as opposed to a seasonal or news post. Most of the library we build for you is evergreen.',
   '{blog}', 310),
  ('Internal linking',
   'Links between your own pages. They help readers find related services and help Google understand which of your pages matter most.',
   '{seo,blog}', 320),
  ('Review velocity',
   'How steadily new reviews arrive. A slow, consistent stream reads as more credible to both Google and pet owners than a sudden burst.',
   '{orm}', 330),
  ('Review response',
   'A public reply to a review. It is written as much for the next person reading it as for the person who left it, which is why we respond to positive reviews too.',
   '{orm}', 340)
on conflict (lower(term)) do nothing;
