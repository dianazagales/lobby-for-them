-- featured_bills table
CREATE TABLE IF NOT EXISTS featured_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  legiscan_bill_id INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'US',
  custom_title TEXT,
  why_it_matters TEXT,
  email_subject TEXT,
  email_body TEXT,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('high', 'medium', 'low')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- legiscan_cache table
CREATE TABLE IF NOT EXISTS legiscan_cache (
  bill_id INTEGER PRIMARY KEY,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  password_hash TEXT NOT NULL
);

-- Seed admin password (default: lobbyforthem2025)
INSERT INTO admin_settings (password_hash) VALUES ('lobbyforthem2025');

-- Seed featured bills
INSERT INTO featured_bills (legiscan_bill_id, state, custom_title, why_it_matters, email_subject, email_body, urgency, active) VALUES
(
  1477,
  'US',
  'Animal Cruelty Enforcement Act of 2025 (H.R. 1477)',
  'This bill strengthens federal penalties for animal cruelty and ensures that the FBI''s National Incident-Based Reporting System fully tracks animal abuse crimes. Right now, animal cruelty cases are often underreported and underprosecuted. This act closes critical gaps in federal enforcement, making it harder for abusers to escape accountability and easier for law enforcement to identify patterns linked to other violent crimes.',
  'Please Support H.R. 1477 — Animal Cruelty Enforcement Act',
  'Dear {{rep_name}},

My name is a constituent from zip code {{user_zip}}, and I am writing to urge your support for {{bill_name}}.

Animals are among the most vulnerable members of our communities, and they depend entirely on us to speak for them. The Animal Cruelty Enforcement Act would strengthen federal protections and close critical gaps in how animal abuse is tracked and prosecuted nationwide.

Research consistently shows that animal cruelty is a predictor of other violent crimes. By better tracking and prosecuting these cases, we protect both animals and our communities.

I urge you to co-sponsor and support this important legislation. Your constituents care deeply about the humane treatment of animals, and this bill reflects our shared values.

Thank you for your time and service.

Sincerely,
A constituent from {{user_zip}}',
  'high',
  true
),
(
  2253,
  'US',
  'Puppy Protection Act of 2025 (H.R. 2253)',
  'Puppy mills are large-scale commercial breeding operations where dogs are kept in cramped, filthy conditions and bred repeatedly with no regard for their health or wellbeing. The Puppy Protection Act would set minimum federal standards for the care of dogs in commercial breeding facilities — including space requirements, veterinary care, and socialization. This is the most direct legislative path to ending the worst abuses of the commercial dog breeding industry.',
  'Please Support H.R. 2253 — Puppy Protection Act',
  'Dear {{rep_name}},

I am writing from {{user_zip}} to ask for your support of {{bill_name}}.

Every year, hundreds of thousands of dogs suffer in puppy mills — large commercial breeding operations where animals are kept in overcrowded, unsanitary conditions and denied basic care. The Puppy Protection Act would establish federal minimum standards to ensure these animals receive the space, veterinary care, and socialization they need.

Consumers deserve to know that the puppies they bring into their homes were raised humanely. And the dogs in these facilities deserve basic protections.

Please co-sponsor and vote yes on this important legislation. It''s time to put people and pets ahead of puppy mill profits.

Thank you,
A constituent from {{user_zip}}',
  'high',
  true
),
(
  349,
  'US',
  'Goldie''s Act (H.R. 349)',
  'Named after a golden retriever who was seized from a USDA-licensed dealer in terrible condition, Goldie''s Act would require USDA inspectors to report animal welfare violations to local law enforcement and veterinarians — and make those inspection reports publicly available. Currently, violations can be documented and still go unaddressed. This bill creates real accountability and transparency in how we oversee commercial animal dealers.',
  'Please Support H.R. 349 — Goldie''s Act',
  'Dear {{rep_name}},

I am writing as a constituent from {{user_zip}} to urge your support for {{bill_name}}.

Goldie''s Act is named after a golden retriever who suffered for years in a federally-licensed facility — visible to USDA inspectors but never helped. This legislation would require USDA inspectors to report animal welfare violations to local law enforcement and veterinarians, and make inspection reports publicly available.

Transparency and accountability are the foundations of effective enforcement. Right now, violations can be documented and ignored. This bill changes that.

Animals like Goldie deserve better. Please support this commonsense legislation that protects animals and strengthens oversight of federally-licensed dealers.

With appreciation,
A constituent from {{user_zip}}',
  'medium',
  true
);
