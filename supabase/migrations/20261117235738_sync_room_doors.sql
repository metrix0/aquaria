alter table aquaria_private.room_tiles drop constraint room_tiles_material_check;
alter table aquaria_private.room_tiles add constraint room_tiles_material_check
  check (material in ('air', 'sand', 'stone', 'wood', 'door'));
alter table aquaria_private.room_edit_operations add column removed_door boolean not null default false;

create or replace function aquaria_private.edit_room_tile(
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
  removed_door boolean := false;
begin
  select * into room from aquaria_private.rooms where id = invite for update;
  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;

  if tile_x is null or tile_y is null or tile_x >= 224 or tile_y < 0 or
     not (
       (room.world_version = 1 and tile_x >= 0 and tile_y < 98) or
       (room.world_version = 2 and tile_x >= -44 and tile_y < 174)
     ) or
     next_material is null or next_material not in ('air', 'sand', 'stone', 'wood', 'door') or
     expected_revision is null or expected_revision < 0 or operation is null then
    raise exception 'Invalid terrain edit' using errcode = '22023';
  end if;

  select * into previous from aquaria_private.room_edit_operations where room_id = invite and id = operation;
  if found then
    if previous.x <> tile_x or previous.y <> tile_y or previous.material <> next_material then
      raise exception 'Operation does not match the original edit' using errcode = '22023';
    end if;
    return jsonb_build_object('accepted', true, 'removedDoor', previous.removed_door, 'tile', jsonb_build_object(
      'x', previous.x, 'y', previous.y, 'material', previous.material, 'revision', previous.revision
    ));
  end if;

  select * into tile from aquaria_private.room_tiles
    where room_id = invite and x = tile_x and y = tile_y;

  if coalesce(tile.revision, 0) = expected_revision then
    if next_material <> 'air' and exists (
      select 1 from aquaria_private.room_tiles where room_id = invite and x = tile_x and y = tile_y + 1 and material = 'door'
    ) then
      raise exception 'A door occupies this tile' using errcode = '22023';
    end if;

    if next_material = 'door' and (
      room.world_version <> 2 or tile_y < 1 or tile_y >= 173 or
      coalesce(tile.material, 'air') <> 'air' or exists (
        select 1 from aquaria_private.room_tiles
        where room_id = invite and x = tile_x and
          ((y = tile_y - 1 and material <> 'air') or (y = tile_y + 1 and material = 'air'))
      )
    ) then
      raise exception 'Door clearance or floor changed' using errcode = '22023';
    end if;

    if next_material = 'air' and tile.material is distinct from 'door' then
      update aquaria_private.room_tiles set material = 'air', revision = room.revision + 1
        where room_id = invite and x = tile_x and y = tile_y - 1 and material = 'door';
      removed_door := found;
    end if;

    update aquaria_private.rooms set revision = revision + case when removed_door then 2 else 1 end where id = invite returning * into room;
    insert into aquaria_private.room_tiles (room_id, x, y, material, revision)
    values (invite, tile_x, tile_y, next_material, room.revision)
    on conflict (room_id, x, y) do update
      set material = excluded.material, revision = excluded.revision
    returning * into tile;
    insert into aquaria_private.room_edit_operations (room_id, id, x, y, material, revision, removed_door)
    values (invite, operation, tile_x, tile_y, next_material, room.revision, removed_door);
    accepted := true;
  end if;

  return jsonb_build_object(
    'accepted', accepted,
    'removedDoor', removed_door,
    'tile', case when tile.revision is null then null else jsonb_build_object(
      'x', tile.x, 'y', tile.y, 'material', tile.material, 'revision', tile.revision
    ) end
  );
end;
$$;
