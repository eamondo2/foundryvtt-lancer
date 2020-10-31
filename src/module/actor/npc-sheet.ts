import {
  LancerNPCSheetData,
  LancerNPCClassStatsData,
  LancerNPCData,
  LancerStatMacroData,
  LancerAttackMacroData,
  LancerTechMacroData,
} from "../interfaces";
import {
  LancerItem,
  LancerNPCClass,
  LancerNPCFeature,
  LancerItemData,
  LancerNPCTemplate,
} from "../item/lancer-item";
import { LancerActor } from "./lancer-actor";
import { LANCER } from "../config";
import { ItemDataManifest } from "../item/util";
import { LancerNPCTechData, LancerNPCWeaponData } from "../item/npc-feature";
const lp = LANCER.log_prefix;

const entryPrompt = "//:AWAIT_ENTRY>";

/**
 * Extend the basic ActorSheet
 */
export class LancerNPCSheet extends ActorSheet {
  _sheetTab: string = ""; // Unused?

  /**
   * A convenience reference to the Actor entity
   */
  // get actor(): LancerPilot {
  //   return this.actor;
  // };

  /* -------------------------------------------- */

  /**
   * Extend and override the default options used by the NPC Sheet
   * @returns {Object}
   */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["lancer", "sheet", "actor", "npc"],
      template: "systems/lancer/templates/actor/npc.html",
      width: 800,
      height: 800,
      tabs: [
        {
          navSelector: ".lancer-tabs",
          contentSelector: ".sheet-body",
          initial: "mech",
        },
      ],
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  getData(): LancerNPCSheetData {
    const data: LancerNPCSheetData = super.getData() as LancerNPCSheetData;

    this._prepareItems(data);

    // Populate name if blank (new Actor)
    if (data.data.name === "") {
      data.data.name = data.actor.name;
    }

    console.log(`${lp} NPC data: `, data);
    return data;
  }

  /* -------------------------------------------- */

  _prepareItems(data: LancerNPCSheetData) {
    // let npc_items = this.actor.items as Collection<LancerItem>;
    // let sorted = new ItemManifest().add_items(npc_items.values());
    let npc_item_data = (data.items as unknown) as LancerItemData[];
    let sorted = new ItemDataManifest().add_items(npc_item_data.values());

    data.npc_templates = (sorted.npc_templates as unknown) as LancerNPCTemplate[]; // Why does this work. Like someone fixed exactly one, lol???
    data.npc_features = (sorted.npc_features as unknown) as LancerNPCFeature[];
    data.npc_class = (sorted.npc_classes[0] as unknown) as LancerNPCClass;
    //TODO Templates, Classes and Features
  }

  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html: JQuery) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Macro triggers
    if (this.actor.owner) {
      // Stat rollers
      let statMacro = html.find(".roll-stat");
      statMacro.on("click", (ev: Event) => {
        if (!ev.currentTarget) return; // No target, let other handlers take care of it.
        ev.stopPropagation(); // Avoids triggering parent event handlers

        // Find the stat input to get the stat's key to pass to the macro function
        const statInput: HTMLInputElement = $(ev.currentTarget)
          .closest(".stat-container")
          .find(".lancer-stat")[0] as HTMLInputElement;
        let tSplit = statInput.name.split(".");
        let mData: LancerStatMacroData = {
          title: tSplit[tSplit.length - 1].toUpperCase(),
          bonus: statInput.value,
        };

        console.log(`${lp} Rolling ${mData.title} check, bonus: ${mData.bonus}`);
        game.lancer.rollStatMacro(this.actor, mData);
      });

      // Trigger rollers
      let triggerMacro = html.find(".roll-trigger");
      triggerMacro.on("click", (ev: Event) => {
        if (!ev.currentTarget) return; // No target, let other handlers take care of it.
        ev.stopPropagation(); // Avoids triggering parent event handlers

        let mData: LancerStatMacroData = {
          title: $(ev.currentTarget).closest(".skill-compact").find(".modifier-name").text(),
          bonus: parseInt($(ev.currentTarget).find(".roll-modifier").text()),
        };

        console.log(`${lp} Rolling '${mData.title}' trigger (d20 + ${mData.bonus})`);
        game.lancer.rollTriggerMacro(this.actor, mData);
      });

      // Weapon rollers
      let weaponMacro = html.find(".roll-attack");
      weaponMacro.on("click", (ev: Event) => {
        if (!ev.currentTarget) return; // No target, let other handlers take care of it.
        ev.stopPropagation(); // Avoids triggering parent event handlers

        const weaponElement = $(ev.currentTarget).closest(".weapon")[0] as HTMLElement;
        const weaponId = weaponElement.getAttribute("data-item-id");
        if (!weaponId) return ui.notifications.warn(`Error rolling macro: No weapon ID!`);
        const weapon = this.actor.getOwnedItem(weaponId) as LancerNPCFeature;
        if (!weapon)
          return ui.notifications.warn(
            `Error rolling macro: Couldn't find weapon with ID ${weaponId}.`
          );
        const wData = weapon.data.data as LancerNPCWeaponData;
        const tier = (this.actor.data.data as LancerNPCData).tier_num - 1;
        let mData: LancerAttackMacroData = {
          title: weapon.name,
          grit: wData.attack_bonus[tier],
          acc: wData.accuracy[tier],
          tags: wData.tags,
          damage: wData.damage.map(d => {
            return { type: d.type, val: d.val[tier] };
          }),
          overkill: weapon.isOverkill,
          effect: wData.effect ? wData.effect : "",
        };

        console.log(`${lp} Rolling NPC attack macro with data:`, mData);
        game.lancer.rollAttackMacro(this.actor, mData);
      });

      // Tech rollers
      let techMacro = html.find(".roll-tech");
      techMacro.on("click", (ev: Event) => {
        if (!ev.currentTarget) return; // No target, let other handlers take care of it.
        ev.stopPropagation();
        const techElement = $(ev.currentTarget).closest(".tech")[0] as HTMLElement;
        const techId = techElement.getAttribute("data-item-id");
        if (!techId) return ui.notifications.warn(`Error rolling macro: No tech feature ID!`);
        const tech = this.actor.getOwnedItem(techId) as LancerNPCFeature;
        if (!tech)
          return ui.notifications.warn(
            `Error rolling macro: Couldn't find tech system with ID ${techId}.`
          );
        const tData = tech.data.data as LancerNPCTechData;
        const tier = (this.actor.data.data as LancerNPCData).tier_num - 1;
        let mData: LancerTechMacroData = {
          title: tData.name,
          acc: tData.accuracy ? tData.accuracy[tier] : 0,
          t_atk: tData.attack_bonus ? tData.attack_bonus[tier] : 0,
          effect: tData.effect ? tData.effect : "",
          tags: tData.tags,
        };
        game.lancer.rollTechMacro(this.actor, mData);
      });
    }
    if (this.actor.owner) {
      // Item/Macroable Dragging
      const haseMacroHandler = (e: DragEvent) => this._onDragMacroableStart(e);
      html
        .find('li[class*="item"]')
        .add('span[class*="item"]')
        .add('[class*="macroable"]')
        .each((i: number, item: any) => {
          if (item.classList.contains("inventory-header")) return;
          if (item.classList.contains("roll-stat"))
            item.addEventListener("dragstart", haseMacroHandler, false);
          item.setAttribute("draggable", true);
          item.addEventListener("dragstart", (ev: DragEvent) => this._onDragStart(ev), false);
        });

      // Update Inventory Item
      let items = html.find(".item");
      items.on("click", (ev: Event) => {
        if (!ev.currentTarget) return; // No target, let other handlers take care of it.
        const li = $(ev.currentTarget);
        const item = this.actor.getOwnedItem(li.data("itemId"));
        if (item) {
          item.sheet.render(true);
        }
      });

      // Delete Item when trash can is clicked
      items = html.find('.stats-control[data-action*="delete"]');
      items.on("click", (ev: Event) => {
        if (!ev.currentTarget) return; // No target, let other handlers take care of it.
        ev.stopPropagation(); // Avoids triggering parent event handlers
        const li = $(ev.currentTarget).closest(".item");
        this.actor.deleteOwnedItem(li.data("itemId"));
        li.slideUp(200, () => this.render(false));
      });

      // Change tier
      let tier_selector = html.find('select.tier-control[data-action*="update"]');
      tier_selector.on("change", (ev: Event) => {
        if (!ev.currentTarget) return; // No target, let other handlers take care of it.
        ev.stopPropagation();
        let tier = (ev.currentTarget as HTMLSelectElement).selectedOptions[0].value;
        this.actor.update({ "data.tier": tier });
        // Set Values for
        let actor = this.actor as LancerActor;
        let NPCClassStats: LancerNPCClassStatsData;
        NPCClassStats = (actor.items.find((i: Item) => i.type === "npc_class") as any).data.data
          .stats;
        console.log(`${lp} TIER Swap with ${tier} and ${NPCClassStats}`);
        actor.swapNPCClassOrTier(NPCClassStats, false, tier);
      });
    }
  }

  _onDragMacroableStart(event: DragEvent) {
    // For roll-stat macros
    event.stopPropagation(); // Avoids triggering parent event handlers
    let statInput = getStatInput(event);
    if (!statInput) return ui.notifications.error("Error finding stat input for macro.");

    let tSplit = statInput.id.split(".");
    let data = {
      title: tSplit[tSplit.length - 1].toUpperCase(),
      dataPath: statInput.id,
      type: "actor",
      actorId: this.actor._id,
    };

    event.dataTransfer?.setData("text/plain", JSON.stringify(data));
  }

  /* -------------------------------------------- */

  async _onDrop(event: any) {
    event.preventDefault();
    // Get dropped data
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      if (data.type !== "Item") return Promise.resolve(false);
    } catch (err) {
      return Promise.resolve(false);
    }
    console.log(event);

    let item: Item | null = null;
    const actor = this.actor as LancerActor;
    // NOTE: these cases are copied almost verbatim from ActorSheet._onDrop

    // Case 1 - Item is from a Compendium pack
    if (data.pack) {
      item = (await game.packs.get(data.pack)!.getEntity(data.id)) as Item;
      console.log(`${lp} Item dropped from compendium: `, item);
    }
    // Case 2 - Item is a World entity
    else if (!data.data) {
      item = game.items.get(data.id);
      // If item isn't from a Compendium or World entity,
      // see if super can do something with it.
      if (!item) super._onDrop(event);
      console.log(`${lp} Item dropped from world: `, item);
    }
    // Logic below this line is executed only with owner or GM permission of a sheet
    if (!actor.owner && !game.user.isGM) {
      ui.notifications.warn(
        `LANCER, you shouldn't try to modify ${actor.name}'s loadout. Access Denied.`
      );
      return Promise.resolve(false);
    }

    if (item) {
      // Swap mech class
      if (item.type === "npc_class") {
        let newNPCClassStats: LancerNPCClassStatsData;
        // Remove old class
        actor.items.forEach(async (i: LancerItem) => {
          if (i.type === "npc_class") {
            console.log(`${lp} Removing ${actor.name}'s old ${i.name} class.`);
            await this.actor.deleteOwnedItem(i._id);
          }
        });
        const npcClass = (await actor.createOwnedItem(duplicate(item.data))) as any;
        console.log(
          `${lp} Added ${npcClass.name} ${data.pack ? `from ${data.pack} ` : ""}to ${actor.name}.`
        );
        newNPCClassStats = npcClass.data.stats;
        if (newNPCClassStats) {
          console.log(`${lp} Swapping Class stats for ${actor.name}`);
          actor.swapNPCClassOrTier(newNPCClassStats, true);
        }
        return Promise.resolve(true);
      } else if (LANCER.npc_items.includes(item.type)) {
        console.log(
          `${lp} Copying ${item.name} ${data.pack ? `from ${data.pack} ` : ""}to ${actor.name}.`
        );
        const dupData = duplicate(item.data);
        const newItem = await actor.createOwnedItem(dupData);
        // Make sure the new item includes all of the data from the original.
        (dupData as any)._id = newItem._id;
        actor.updateOwnedItem(dupData);
        return Promise.resolve(true);
      }
      //TODO add basic features to NPC
      //TODO remove basic feature from NPC on Class swap
      //TODO implement similar logic for Templates
      else if (LANCER.pilot_items.includes(item.type)) {
        ui.notifications.error(`Cannot add Item of type "${item.type}" to an NPC.`);
        return Promise.resolve(false);
      }

      return super._onDrop(event);
    }
  }

  /* -------------------------------------------- */

  /**
   * Implement the _updateObject method as required by the parent class spec
   * This defines how to update the subject of the form when the form is submitted
   * @private
   */
  _updateObject(event: Event | JQuery.Event, formData: any): Promise<any> {
    // Copy the NPC name into the Actor data.
    formData["name"] = formData["data.name"];
    // Copy the NPC name to the prototype token.
    formData["token.name"] = formData["data.name"];

    let token: any = this.actor.data["token"];
    // Set the prototype token image if the prototype token isn't initialized
    if (!token) {
      formData["token.img"] = formData["img"];
    }
    // Update token image if it matches the old actor image
    else if (this.actor.data.img === token["img"] && this.actor.img !== formData["img"]) {
      formData["token.img"] = formData["img"];
    }

    console.log(`${lp} NPC sheet form data: `, formData);
    // Update the Actor
    return this.object.update(formData);
  }
}

function getStatInput(event: Event): HTMLInputElement | HTMLDataElement | null {
  if (!event.currentTarget) return null;
  // Find the stat input to get the stat's key to pass to the macro function
  return $(event.currentTarget).closest(".stat-container").find(".lancer-stat")[0] as
    | HTMLInputElement
    | HTMLDataElement;
}
