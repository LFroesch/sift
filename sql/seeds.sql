-- Sift feed seeds — run with: make seed
-- Safe to re-run (ON CONFLICT DO NOTHING)

INSERT INTO feeds (name, url) VALUES

-- YouTube: Tech creators
('ThePrimeagen',     'https://www.youtube.com/feeds/videos.xml?channel_id=UCUyeluBRhGPCW4rPe_UvBZQ'),
('Fireship',         'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA'),
('Theo (t3.gg)',     'https://www.youtube.com/feeds/videos.xml?channel_id=UCbRP3rqMQRVNBOVGHNHV1tA'),
('TJ DeVries',       'https://www.youtube.com/feeds/videos.xml?channel_id=UC9y2j_HkEVJvnxl_S89vFyA'),
('The Primeagen Clips', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC2S0jqRoKjMwBqvKK4imyhQ'),

-- Tech news
('Hacker News',      'https://news.ycombinator.com/rss'),
('Ars Technica',     'https://feeds.arstechnica.com/arstechnica/technology-lab'),
('The Verge',        'https://www.theverge.com/rss/index.xml'),
('TechCrunch',       'https://techcrunch.com/feed/'),
('Wired',            'https://www.wired.com/feed/rss'),

-- AI / ML subreddits
('r/LocalLLaMA',     'https://www.reddit.com/r/LocalLLaMA.rss'),
('r/ClaudeAI',       'https://www.reddit.com/r/ClaudeAI.rss'),
('r/Anthropic',      'https://www.reddit.com/r/Anthropic.rss'),
('r/ChatGPT',        'https://www.reddit.com/r/ChatGPT.rss'),
('r/artificial',     'https://www.reddit.com/r/artificial.rss'),
('r/MachineLearning','https://www.reddit.com/r/MachineLearning.rss'),
('r/singularity',    'https://www.reddit.com/r/singularity.rss'),

-- Dev subreddits
('r/programming',    'https://www.reddit.com/r/programming.rss'),
('r/golang',         'https://www.reddit.com/r/golang.rss'),
('r/webdev',         'https://www.reddit.com/r/webdev.rss'),
('r/vibecoding',     'https://www.reddit.com/r/vibecoding.rss'),
('r/ExperiencedDevs','https://www.reddit.com/r/ExperiencedDevs.rss')

ON CONFLICT (url) DO NOTHING;
