-- A save names the version it started from, so two people editing can't overwrite
-- each other. The save and its history snapshot happen in one statement.
alter table hh_sites add column version int not null default 0;
grant update (version) on hh_sites to hh_app;
