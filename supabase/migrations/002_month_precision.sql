-- Lets a read be dated to a month ("September 2026") as well as exact day, year or decade.
alter type date_precision add value if not exists 'month' after 'exact';
