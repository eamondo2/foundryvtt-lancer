import type { HelperOptions } from "handlebars";
import { ChipIcons, EntryType } from "../enums";
import type { LancerMacroData } from "../interfaces";
import { encodeMacroData } from "../macros";
import { inc_if, resolve_helper_dotpath, array_path_edit } from "./commons";
import { mech_weapon_refview, buildActionHTML, buildDeployableHTML, buildChipHTML } from "./item";
import { editable_mm_ref_list_item, ref_params, simple_ref_slot } from "./refs";
import { compact_tag_list } from "./tags";
import type { LancerActor, LancerMECH, LancerPILOT } from "../actor/lancer-actor";
import { SystemData } from "../system-template";
import { LancerCORE_BONUS, LancerFRAME } from "../item/lancer-item";
import { ActionData } from "../models/bits/action";

export type CollapseRegistry = { [LID: string]: number };

// A drag-drop slot for a system mount. TODO: delete button, clear button
function system_mount(
  mech_path: string,
  mount_path: string,
  helper: HelperOptions,
  registry?: CollapseRegistry
): string {
  return "TODO";
  /*
  let mount = resolve_helper_dotpath(helper, mount_path) as SystemMount;
  if (!mount) return "";

  let item_: RegEntry<EntryType.MECH_SYSTEM> | null = resolve_helper_dotpath(helper, `${mount_path}.System`);
  if (item_) {
    let slot = editable_mm_ref_list_item(`${mount_path}.System`, "delete", helper, registry);

    return ` 
      <div class="mount card clipped">
        ${slot}
      </div>`;
  } else {
    // Assuming we just want to delete empty mounts, which may be a faulty assumption
    array_path_edit(helper.data.root, mount_path, null, "delete");
    return system_mount(mech_path, mount_path, helper);
  }
  */
}

// A drag-drop slot for a weapon mount. TODO: delete button, clear button
function weapon_mount(
  mech_path: string,
  mount_path: string,
  helper: HelperOptions,
  registry: CollapseRegistry
): string {
  let mech = resolve_helper_dotpath(helper, mech_path) as LancerMECH;
  let mount = resolve_helper_dotpath(helper, mount_path) as SystemData.Mech["loadout"]["weapon_mounts"][0];

  // If bracing, override
  if (mount.bracing) {
    return ` 
    <div class="mount card" >
      <div class="lancer-header mount-type-ctx-root" data-path="${mount_path}">
        <span>${mount.type} Weapon Mount</span>
        <a class="gen-control fas fa-trash" data-action="splice" data-path="${mount_path}"></a>
        <a class="reset-weapon-mount-button fas fa-redo" data-path="${mount_path}"></a>
      </div>
      <div class="lancer-body">
        <span class="major">LOCKED: BRACING</span>
      </div>
    </div>`;
  }

  let slots = mount.slots.map((slot, index) =>
    mech_weapon_refview(`${mount_path}.slots.${index}.weapon`, mech_path, helper, registry, slot.size)
  );
  let err = mech.validateMount(mount) ?? "";

  // FLEX mount weirdness.
  if (!err && mount.type === "Flex") {
    if (mount.slots[0].weapon && mount.slots[0].weapon.value?.system.size === "Main") {
      slots.pop();
    } else if (mount.slots[1].weapon?.value?.system.size && mount.slots[1].size === "Auxiliary") {
      slots[0] = slots[0].replace("Insert Main", "Insert Auxiliary");
    }
  }

  return ` 
    <div class="mount card" >
      <div class="lancer-header mount-type-ctx-root" data-path="${mount_path}">
        <span>${mount.type} Weapon Mount</span>
        <a class="gen-control fas fa-trash" data-action="splice" data-path="${mount_path}"></a>
        <a class="reset-weapon-mount-button fas fa-redo" data-path="${mount_path}"></a>
      </div>
      ${inc_if(`<span class="lancer-header error">${err.toUpperCase()}</span>`, err)}
      <div class="lancer-body">
        ${slots.join("")}
      </div>
    </div>`;
}

// Helper to display all weapon mounts on a mech loadout
function all_weapon_mount_view(
  mech_path: string,
  loadout_path: string,
  helper: HelperOptions,
  registry: CollapseRegistry
) {
  let loadout = resolve_helper_dotpath(helper, loadout_path) as SystemData.Mech["loadout"];
  const weapon_mounts = loadout.weapon_mounts.map((_wep, index) =>
    weapon_mount(mech_path, `${loadout_path}.WepMounts.${index}`, helper, registry)
  );

  return `
    <span class="lancer-header loadout-category submajor">
        <i class="mdi mdi-unfold-less-horizontal collapse-trigger collapse-icon" data-collapse-id="weapons"></i>   
        <span>MOUNTED WEAPONS</span>
        <a class="gen-control fas fa-plus" data-action="append" data-path="${loadout_path}.WepMounts" data-action-value="(struct)wep_mount"></a>
        <a class="reset-all-weapon-mounts-button fas fa-redo" data-path="${loadout_path}.WepMounts"></a>
    </span>
    <div class="wraprow double collapse" data-collapse-id="weapons">
      ${weapon_mounts.join("")}
    </div>
    `;
}

// Helper to display all system mounts on a mech loadout
function all_system_mount_view(
  mech_path: string,
  loadout_path: string,
  helper: HelperOptions,
  _registry: CollapseRegistry
) {
  let loadout = resolve_helper_dotpath(helper, loadout_path) as LancerMECH["system"]["loadout"];
  const system_slots = loadout.systems.map(
    (_sys, index) => system_mount(mech_path, `${loadout_path}.SysMounts.${index}`, helper, _registry) // TODO: rework
  );

  // Archiving add button: <a class="gen-control fas fa-plus" data-action="append" data-path="${loadout_path}.SysMounts" data-action-value="(struct)sys_mount"></a>

  return `
    <span class="lancer-header loadout-category submajor">
      <i class="mdi mdi-unfold-less-horizontal collapse-trigger collapse-icon" data-collapse-id="systems"></i>    
      <span>MOUNTED SYSTEMS</span>
      <span style="height:15px;width:48px;padding:0;"></span>
    </span>
    <div class="flexcol collapse" data-collapse-id="systems">
      ${system_slots.join("")}
    </div>
    `;
}

/** Suuuuuper work in progress helper. The loadout view for a mech (tech here can mostly be reused for pilot)
 * TODO:
 * - Weapon mods
 * - .... system mods :)
 * - Ref validation (you shouldn't be able to equip another mechs items, etc)
 */
export function mech_loadout(mech_path: string, helper: HelperOptions): string {
  const mech: LancerMECH = resolve_helper_dotpath(helper, mech_path);
  const registry: CollapseRegistry = {};

  if (!mech) {
    return "err";
  }
  const loadout_path = `${mech_path}.Loadout`;
  return `
    <div class="flexcol">
        ${all_weapon_mount_view(mech_path, loadout_path, helper, registry)}
        ${all_system_mount_view(mech_path, loadout_path, helper, registry)}
    </div>`;
}

// Create a div with flags for dropping native pilots
export function pilot_slot(data_path: string, options: HelperOptions): string {
  // get the existing
  let existing = resolve_helper_dotpath<LancerPILOT | null>(options, data_path, null);
  if (!existing) return simple_ref_slot(EntryType.PILOT, existing, "No Pilot", data_path, true);

  return `<div class="pilot-summary">
    <img class="valid ${existing.type} ref clickable-ref" ${ref_params(existing)} style="height: 100%" src="${
    existing.img
  }"/>
    <div class="license-level">
      <span>LL${existing.system.level}</span>
    </div>
</div>`;
}

/**
 * Builds HTML for a frame reference. Either an empty ref to give a drop target, or a preview
 * with traits and core system.
 * @param actor       Actor the ref belongs to.
 * @param frame_path  Path to the frame's location in actor data.
 * @param helper      Standard helper options.
 * @return            HTML for the frame reference, typically for inclusion in a mech sheet.
 */
export function mech_frame_refview(actor: LancerActor, frame_path: string, helper: HelperOptions): string {
  let frame = resolve_helper_dotpath<LancerFRAME | null>(helper, frame_path, null);
  if (!frame) return simple_ref_slot(EntryType.FRAME, frame, "No Frame", frame_path, true);

  return `
    <div class="card mech-frame ${ref_params(frame)}">
      <span class="lancer-header submajor clipped-top">
       ${frame.name}
      </span>
      <div class="wraprow double">
        <div class="frame-traits flexcol">
          ${frameTraits(actor, frame)}
        </div>
        ${inc_if(buildCoreSysHTML(actor, frame.system.core_system), frame.system.core_system)}
      </div>
    </div>
    `;
}

/**
 * Builds HTML for a mech's core system.
 * @param actor   Mech actor which owns the core system.
 * @param core    The core system.
 * @return        HTML for the core system, typically for inclusion in a mech sheet.
 */
function buildCoreSysHTML(actor: LancerActor, core: LancerFRAME["system"]["core_system"]): string {
  let tags: string | undefined;
  tags = compact_tag_list("", core.tags, false);

  // Removing desc temporarily because of space constraints
  // <div class="frame-core-desc">${core.Description ? core.Description : ""}</div>

  // Generate core passive HTML only if it has one
  let passive = "";
  if (core.passive_effect !== "" || core.passive_actions.length > 0 || core.passive_bonuses.length > 0) {
    passive = `<div class="frame-passive">${frame_passive(core)}</div>`;
  }

  return `<div class="core-wrapper frame-coresys clipped-top" style="padding: 0;">
    <div class="lancer-title coresys-title clipped-top">
      <span>${core.name}</span> // CORE
      <i 
        class="mdi mdi-unfold-less-horizontal collapse-trigger collapse-icon" 
        data-collapse-id="${actor.id}_coresys" > 
      </i>
    </div>
    <div class="collapse" data-collapse-id="${actor.id}_coresys">
      <div class="frame-active">${frame_active(actor, core)}</div>
      ${passive}
      ${tags ? tags : ""}
    </div>
  </div>`;
}

function frameTraits(actor: LancerActor, frame: LancerFRAME): string {
  return frame.system.traits
    .map((t, i) => {
      return buildFrameTrait(actor, t, i);
    })
    .join("");
}

function buildFrameTrait(actor: LancerActor, trait: LancerFRAME["system"]["traits"][0], index: number): string {
  let actionHTML = trait.actions
    .map((a, i) => {
      return buildActionHTML(a, { full: true, num: i });
    })
    .join("");

  let depHTML = trait.deployables
    .map((d, i) => {
      return d.status == "resolved" ? buildDeployableHTML(d.value, true, i) : "";
    })
    .join("");

  let macroData: LancerMacroData = {
    title: trait.name,
    iconPath: `systems/${game.system.id}/assets/icons/macro-icons/trait.svg`,
    fn: "prepareFrameTraitMacro",
    args: [actor.id, index],
  };

  return `<div class="frame-trait clipped-top">
    <div class="lancer-header submajor frame-trait-header" style="display: flex">
      <a class="lancer-macro" data-macro="${encodeMacroData(macroData)}"><i class="mdi mdi-message"></i></a>
      <span class="minor grow">${trait.name}</span>
    </div>
    <div class="lancer-body">
      <div class="effect-text">${trait.description}</div>
      ${actionHTML ? actionHTML : ""}
      ${depHTML ? depHTML : ""}
    </div>
  </div>`;
}

function frame_active(actor: LancerActor, core: LancerFRAME["system"]["core_system"]): string {
  // So we have a CoreSystem with all the traits of an action inside itself as Active and Passive...
  // And then it has whole other arrays for its actions
  // :pain:

  let actionHTML = core.active_actions
    .map((a: ActionData, i: number | undefined) => {
      return buildActionHTML(a, { full: true, num: i });
    })
    .join("");

  let depHTML = core.deployables
    .map((d, i) => {
      return d.status == "resolved" ? buildDeployableHTML(d.value, true, i) : "";
    })
    .join("");

  // Should find a better way to do this...
  let coreMacroData: LancerMacroData = {
    title: `${actor.name} | CORE POWER`,
    iconPath: `systems/${game.system.id}/assets/icons/macro-icons/corebonus.svg`,
    fn: "prepareCoreActiveMacro",
    args: [actor.id],
  };

  return `
  <div class="core-active-wrapper clipped-top">
    <span class="lancer-header submajor">
      ${core.active_name} // ACTIVE
    </span>
    <div class="lancer-body">
      <div class="effect-text">
        ${core.active_effect ?? ""}
      </div>
      ${actionHTML ? actionHTML : ""}
      ${depHTML ? depHTML : ""}
      ${buildChipHTML(core.activation, { icon: ChipIcons.Core, fullData: coreMacroData })}
    </div>
  </div>
  `;
}

function frame_passive(core: LancerFRAME["system"]["core_system"]): string {
  let actionHTML = core.passive_actions
    .map((a: ActionData, i: number | undefined) => {
      return buildActionHTML(a, { full: true, num: i });
    })
    .join("");

  return `
  <div class="core-active-wrapper clipped-top">
    <span class="lancer-header submajor">
      ${core.passive_name ?? ""} // PASSIVE
    </span>
    <div class="lancer-body">
      <div class="effect-text">
        ${core.passive_effect ?? ""}
      </div>
      ${actionHTML ?? ""}
    </div>
  </div>
  `;
}
