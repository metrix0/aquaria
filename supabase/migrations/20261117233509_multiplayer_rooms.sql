create schema aquaria_private;
revoke all on schema aquaria_private from public, anon, authenticated;

create table aquaria_private.rooms (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null unique default gen_random_uuid(),
  world_version smallint not null default 1 check (world_version > 0),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now()
);

create table aquaria_private.room_tiles (
  room_id uuid not null references aquaria_private.rooms(id) on delete cascade,
  x integer not null check (x >= 0),
  y integer not null check (y >= 0),
  material text not null check (material in ('air', 'sand', 'stone', 'wood')),
  revision bigint not null check (revision > 0),
  primary key (room_id, x, y)
);

create table aquaria_private.room_edit_operations (
  room_id uuid not null references aquaria_private.rooms(id) on delete cascade,
  id uuid not null,
  x integer not null,
  y integer not null,
  material text not null,
  revision bigint not null,
  primary key (room_id, id)
);

create index room_tiles_revision_idx on aquaria_private.room_tiles (room_id, revision);
alter table aquaria_private.rooms enable row level security;
alter table aquaria_private.room_tiles enable row level security;
alter table aquaria_private.room_edit_operations enable row level security;
revoke all on all tables in schema aquaria_private from public, anon, authenticated;

-- The room UUID is an invitation capability. The separate topic UUID is revealed only to holders of that capability.
create function aquaria_private.create_room()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  insert into aquaria_private.rooms default values
  returning jsonb_build_object('id', id, 'topic', topic_id, 'worldVersion', world_version, 'revision', revision, 'tiles', '[]'::jsonb)
$$;

create function aquaria_private.room_snapshot(invite uuid, after_revision bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', room.id, 'topic', room.topic_id, 'worldVersion', room.world_version, 'revision', room.revision,
    'tiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'x', tile.x, 'y', tile.y, 'material', tile.material, 'revision', tile.revision
      ) order by tile.revision)
      from aquaria_private.room_tiles as tile
      where tile.room_id = room.id and tile.revision > greatest(0, after_revision)
    ), '[]'::jsonb)
  )
  from aquaria_private.rooms as room
  where room.id = invite
$$;

create function aquaria_private.edit_room_tile(
  invite uuid, tile_x integer, tile_y integer, next_material text, expected_revision bigint, operation uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  room aquaria_private.rooms%rowtype;
  tile aquaria_private.room_tiles%rowtype;
  previous aquaria_private.room_edit_operations%rowtype;
  accepted boolean := false;
begin
  select * into room from aquaria_private.rooms where id = invite for update;
  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;

  if room.world_version <> 1 or tile_x is null or tile_y is null or
     tile_x < 0 or tile_x >= 224 or tile_y < 0 or tile_y >= 98 or
     next_material is null or next_material not in ('air', 'sand', 'stone', 'wood') or
     expected_revision is null or expected_revision < 0 or operation is null then
    raise exception 'Invalid terrain edit' using errcode = '22023';
  end if;

  select * into previous from aquaria_private.room_edit_operations where room_id = invite and id = operation;
  if found then
    if previous.x <> tile_x or previous.y <> tile_y or previous.material <> next_material then
      raise exception 'Operation does not match the original edit' using errcode = '22023';
    end if;
    return jsonb_build_object('accepted', true, 'tile', jsonb_build_object(
      'x', previous.x, 'y', previous.y, 'material', previous.material, 'revision', previous.revision
    ));
  end if;

  select * into tile from aquaria_private.room_tiles
    where room_id = invite and x = tile_x and y = tile_y;

  if coalesce(tile.revision, 0) = expected_revision then
    update aquaria_private.rooms set revision = revision + 1 where id = invite returning * into room;
    insert into aquaria_private.room_tiles (room_id, x, y, material, revision)
    values (invite, tile_x, tile_y, next_material, room.revision)
    on conflict (room_id, x, y) do update
      set material = excluded.material, revision = excluded.revision
    returning * into tile;
    insert into aquaria_private.room_edit_operations (room_id, id, x, y, material, revision)
    values (invite, operation, tile_x, tile_y, next_material, room.revision);
    accepted := true;
  end if;

  return jsonb_build_object(
    'accepted', accepted,
    'tile', case when tile.revision is null then null else jsonb_build_object(
      'x', tile.x, 'y', tile.y, 'material', tile.material, 'revision', tile.revision
    ) end
  );
end;
$$;

-- Only these invoker entry points are exposed through the Data API.
create function public.aquaria_create_room()
returns jsonb language sql security invoker set search_path = ''
as $$ select aquaria_private.create_room() $$;

create function public.aquaria_room_snapshot(invite uuid, after_revision bigint default 0)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select aquaria_private.room_snapshot(invite, after_revision) $$;

create function public.aquaria_edit_room_tile(
  invite uuid, tile_x integer, tile_y integer, next_material text, expected_revision bigint, operation uuid
)
returns jsonb language sql security invoker set search_path = ''
as $$ select aquaria_private.edit_room_tile(invite, tile_x, tile_y, next_material, expected_revision, operation) $$;

revoke execute on all functions in schema aquaria_private from public, anon, authenticated;
revoke execute on function public.aquaria_create_room(),
  public.aquaria_room_snapshot(uuid, bigint),
  public.aquaria_edit_room_tile(uuid, integer, integer, text, bigint, uuid)
from public, anon, authenticated;

grant usage on schema aquaria_private to anon, authenticated;
grant execute on function aquaria_private.create_room(),
  aquaria_private.room_snapshot(uuid, bigint),
  aquaria_private.edit_room_tile(uuid, integer, integer, text, bigint, uuid),
  public.aquaria_create_room(),
  public.aquaria_room_snapshot(uuid, bigint),
  public.aquaria_edit_room_tile(uuid, integer, integer, text, bigint, uuid)
to anon, authenticated;
