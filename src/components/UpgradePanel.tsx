/** UI-only upgrade tabs; the App shell still owns purchases and persistence. */
import React from "react";
import UpgradeRow, { type BuyQuantity } from "./UpgradeRow";
import InfoRow from "./InfoRow";
import PixelIcon from "./PixelIcon";
import { nextGas } from "../game/gases";
import { SPLIT_CAP, MAX_VOLT_LEVELS, legacyVoltMult, splitMult, voltMult } from "../game/config";
import { MAX_BULK_PURCHASE, bulkCost, canAfford, cracklePower, peekCost } from "../game/economy";
import { previewPurchaseImpact } from "../game/purchasePreview";
import type { BuyKind } from "../game/economy";
import { fmt } from "../utils/format";
import { helperCapacity } from "../game/prestige";
import { HELPER_CATALOG, helperOwned, helperUnlocked, helperVisible } from "../game/helpers";
import { canDiscoverNextGas, neonChapterComplete, neonMasteryProgress, neonProducedThisRun, NEON_MASTERY_REQUIRED } from "../game/mastery";
import { SPARK_MITE_FRAMES, COPPER_SPIDER_FRAMES, MITE_PALETTE, SPIDER_PALETTE } from "../render/neonCreatures";
import { FINGER_SPRITE, FOOT_SPRITE, GHOST_SPRITE, STICKMAN_SPRITE, GAS_ICON, FIL_ICON, VOLT_ICON, SPLIT_ICON } from "../render/sprites";
import { SKIN_PALETTE, TOE_PALETTE, GHOST_PALETTE, STICKMAN_PALETTE } from "../render/palette";
import type { Gas, GasId, GameState, HelperId } from "../game/types";

export type UpTab = "help" | "gas" | "power";

export default function UpgradePanel({ state, unlockedGases, accent, upTab, onUpTabChange, quantities, onQuantityChange, onBuy, purchaseFeedback }: {
  state: GameState; unlockedGases: Gas[]; accent: string;
  upTab: UpTab; onUpTabChange: (tab: UpTab) => void;
  quantities: Record<string, BuyQuantity>;
  onQuantityChange: (key: string, quantity: BuyQuantity) => void;
  onBuy: (kind: BuyKind, gid?: GasId, quantity?: BuyQuantity) => void;
  purchaseFeedback?: { key: string; message: string } | null;
}) {
  const rowKey = (kind: BuyKind, gid?: GasId) => gid ? `${kind}:${gid}` : kind;
  const selected = (kind: BuyKind, gid?: GasId): BuyQuantity =>
    quantities[rowKey(kind, gid)] ?? 1;
  const quote = (kind: BuyKind, gid?: GasId) => {
    const quantity = selected(kind, gid);
    return bulkCost(state, kind, gid, quantity === "max" ? MAX_BULK_PURCHASE : quantity);
  };
  const quantityProps = (kind: BuyKind, gid: GasId | undefined, offeredCount: number) => ({
    quantity: selected(kind, gid),
    onQtyChange: (value: BuyQuantity) => onQuantityChange(rowKey(kind, gid), value),
    benefit: previewPurchaseImpact(state, kind, gid, Math.max(1, offeredCount))?.preview,
    purchased: purchaseFeedback?.key === rowKey(kind, gid) ? purchaseFeedback.message : undefined,
  });
  const helperImages: Record<HelperId, { sprite: string[]; palette: Record<string, string> }> = {
    finger: { sprite: FINGER_SPRITE, palette: SKIN_PALETTE },
    sparkMite: { sprite: SPARK_MITE_FRAMES[0], palette: MITE_PALETTE },
    copperSpider: { sprite: COPPER_SPIDER_FRAMES[0], palette: SPIDER_PALETTE },
    toe: { sprite: FOOT_SPRITE, palette: TOE_PALETTE },
    ghost: { sprite: GHOST_SPRITE, palette: GHOST_PALETTE },
    stickman: { sprite: STICKMAN_SPRITE, palette: STICKMAN_PALETTE },
  };
  const nxGas = nextGas(state.unlocked);

  // afford dots for sub-tabs (shown only on tabs you're NOT looking at)
  const powerKinds: BuyKind[] = ["filament", "voltage", "split"];
  const subDots: Record<UpTab, boolean> = {
    help: HELPER_CATALOG.some(helper =>
      helperUnlocked(state, helper.id) && quote(helper.id).count > 0),
    gas: !!nxGas && canDiscoverNextGas(state) && canAfford(state, nxGas.unlockCost),
    power: unlockedGases.some((g) => powerKinds.some((k) => bulkCost(state, k, g.id, 1).count > 0)),
  };

  const buy = onBuy;

  return (
            <div className="flex flex-col gap-1">
              {/* Category tabs only. The compact bulk selector lives above the game. */}
              <div className="sticky top-0 z-10 -mx-2 bg-[#0d0820] px-2 pb-0.5 pt-0.5">
                <div role="tablist" aria-label="Upgrade categories" className="grid grid-cols-3 overflow-hidden border border-white/20 bg-[#140c2b]">
                  {([
                    ["help", "HELP"],
                    ["power", "POWER"],
                    ["gas", "GAS"],
                  ] as [UpTab, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      id={`upgrade-tab-${id}`}
                      type="button"
                      onClick={() => onUpTabChange(id)}
                      role="tab"
                      aria-controls={`upgrade-panel-${id}`}
                      aria-selected={upTab === id}
                      className={`min-h-[36px] border-r border-white/10 py-1 text-[11px] tracking-wide active:translate-y-[1px] ${
                        upTab === id ? "bg-[#21153f] text-white" : "text-white/65"
                      }`}
                      style={upTab === id ? { borderBottom: `2px solid ${accent}` } : { borderBottom: "2px solid transparent" }}
                    >
                      {label}
                      {upTab !== id && subDots[id] && (
                        <span className="ml-1 inline-block h-1 w-1 align-middle" style={{ background: accent }} />
                      )}
                    </button>
                  ))}
                </div>


              </div>

              <div id={`upgrade-panel-${upTab}`} role="tabpanel" aria-labelledby={`upgrade-tab-${upTab}`} className="flex flex-col gap-1">
              {upTab === "help" && (
                <>
                  {HELPER_CATALOG.filter(helper => helperVisible(state, helper.id)).map(helper => {
                    const unlocked = helperUnlocked(state, helper.id);
                    const offer = unlocked ? quote(helper.id) : null;
                    const image = helperImages[helper.id];
                    const own = helperOwned(state, helper.id);
                    return (
                      <UpgradeRow
                        key={helper.id}
                        name={helper.name}
                        sub={unlocked
                          ? `POWER ${helper.power} · OWN ${own}/${helperCapacity(state, helper.id)}` +
                            (offer && offer.count > 1 ? ` · +${offer.count}` : "")
                          : `UNLOCKS WITH ${helper.nativeGas.toUpperCase()} GAS`}
                        cost={offer?.cost ?? peekCost(state, helper.id)}
                        icon={<PixelIcon sprite={image.sprite} palette={image.palette} px={helper.iconPixelScale} />}
                        onBuy={() => { if (unlocked) buy(helper.id, undefined, selected(helper.id)); }}
                        {...(unlocked ? quantityProps(helper.id, undefined, offer?.count ?? 0) : {})}
                        disabled={!unlocked || !offer || offer.count === 0}
                        locked={!unlocked}
                        color={helper.shopColor}
                        nextCost={unlocked ? peekCost(state, helper.id) : undefined}
                        plasma={state.plasma}
                        unlockCost={!unlocked ? nxGas?.unlockCost : undefined}
                      />
                    );
                  })}
                </>
              )}

              {upTab === "gas" && (
                <>
                  {unlockedGases.map((g) => (
                    <InfoRow
                      key={g.id}
                      name={`${g.name} GAS`}
                      sub={`IN THE GLASS · ${fmt(g.baseRate)} BASE/TAP · ${fmt(cracklePower(g, state))} NOW`}
                      icon={<PixelIcon sprite={GAS_ICON} color={g.color} px={3} />}
                      color={g.color}
                    />
                  ))}
                  {nxGas?.id === "argon" && (
                    <section aria-label="Neon Mastery" className="mb-1 border border-[#ff78c4]/40 bg-[#21112f] px-2 py-2">
                      <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-[#ff9ed6]">
                        <span>NEON MASTERY</span>
                        <span className="tabular-nums">{Math.floor(neonMasteryProgress(state))}%</span>
                      </div>
                      <div role="progressbar" aria-label="Neon Mastery progress"
                        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(neonMasteryProgress(state))}
                        className="h-[9px] overflow-hidden border border-[#ff9aca]/50 bg-[#0c0619]">
                        <div className="h-full bg-[#fa64b5]" style={{ width: `${neonMasteryProgress(state)}%` }} />
                      </div>
                      <div className="mt-1 text-[9px] leading-[13px] text-white/80">
                        {fmt(neonProducedThisRun(state))} / {fmt(NEON_MASTERY_REQUIRED)} NEON EARNED THIS RUN
                      </div>
                      <div className="mt-0.5 text-[9px] leading-[13px]"
                        style={{ color: state.copperSpiders > 0 ? "#9df4bd" : "#d8b8e8" }}>
                        {state.copperSpiders > 0 ? "COPPER SPIDER DISCOVERED" : helperVisible(state, "copperSpider")
                          ? "BUY A COPPER SPIDER TO COMPLETE MASTERY" : "DISCOVER MORE NEON HELPERS TO ADVANCE"}
                      </div>
                      {neonChapterComplete(state) && <div className="mt-1 text-[9px] font-bold text-[#9df4bd]">ARGON DISCOVERY AVAILABLE</div>}
                    </section>
                  )}
                  {nxGas
                    ? (
                      <React.Fragment>
                        <UpgradeRow
                          name={`${nxGas.name} GAS`}
                          sub={nxGas.id === "argon" && !neonChapterComplete(state)
                            ? (helperVisible(state, "copperSpider") ? "REQUIRES NEON MASTERY & COPPER SPIDER" : "REQUIRES NEON MASTERY")
                            : `NEW CURRENCY · ${fmt(nxGas.baseRate)}/TAP BASE`}
                          cost={nxGas.unlockCost}
                          icon={<PixelIcon sprite={GAS_ICON} color={nxGas.color} px={3} />}
                          onBuy={() => buy("gas")}
                          purchased={purchaseFeedback?.key === "gas" ? purchaseFeedback.message : undefined}
                          disabled={!canDiscoverNextGas(state) || !canAfford(state, nxGas.unlockCost)}
                          plasma={state.plasma}
                          color={nxGas.color}
                        />
                      </React.Fragment>
                    )
                    : (
                      <InfoRow
                        name="MORE GAS"
                        sub="A FUTURE BUILD MIGHT HOLD HEAVIER GASES"
                        icon={<PixelIcon sprite={GAS_ICON} color="#ffffff40" px={3} />}
                      />
                    )}
                </>
              )}

              {upTab === "power" && (
                <>
                  {unlockedGases.map((g) => {
                    const fil = state.filaments[g.id];
                    const nextPow = cracklePower(g, { ...state, filaments: { ...state.filaments, [g.id]: fil + 1 } });
                    const filBuy = quote("filament", g.id);
                    const steps = state.voltage[g.id];
                    const voltBuy = quote("voltage", g.id);
                    const spl = state.splits[g.id];
                    const splitBuy = quote("split", g.id);
                    return (
                      <React.Fragment key={g.id}>
                        <div className="mt-1 mb-0.5 px-0.5 text-[10px] font-bold tracking-widest" style={{ color: g.color }}>
                          {g.name}
                        </div>
                        <UpgradeRow
                          name={`${g.name} ARC`}
                          sub={`+1 ARC · ${fmt(cracklePower(g, state))}→${fmt(nextPow)}/T · ${fil}/${g.cap}` +
                            (filBuy.count > 1 ? ` · +${filBuy.count}` : "")}
                          cost={filBuy.cost}
                          icon={<PixelIcon sprite={FIL_ICON} color={g.color} px={3} />}
                          onBuy={() => buy("filament", g.id, selected("filament", g.id))}
                          {...quantityProps("filament", g.id, filBuy.count)}
                          disabled={filBuy.count === 0}
                          color={g.color}
                          nextCost={peekCost(state, "filament", g.id)}
                          plasma={state.plasma}
                        />
                        <UpgradeRow
                          name={`${g.name} VOLTS`}
                          sub={`+10% BASE · LV ${steps}/${MAX_VOLT_LEVELS} · X${voltMult(steps, state.legacyVoltage[g.id]).toFixed(2)}` +
                            (state.legacyVoltage[g.id] ? ` · OLD X${legacyVoltMult(state.legacyVoltage[g.id]).toFixed(2)}` : "") +
                            (voltBuy.count > 1 ? ` · +${voltBuy.count} LEVELS` : "")}
                          cost={voltBuy.cost}
                          icon={<PixelIcon sprite={VOLT_ICON} color={g.color} px={3} />}
                          onBuy={() => buy("voltage", g.id, selected("voltage", g.id))}
                          {...quantityProps("voltage", g.id, voltBuy.count)}
                          disabled={voltBuy.count === 0}
                          color={g.color}
                          nextCost={peekCost(state, "voltage", g.id)}
                          plasma={state.plasma}
                        />
                        <UpgradeRow
                          name={`${g.name} SPLIT`}
                          sub={`+1 BRANCH (0.75×) · X${splitMult(spl).toFixed(2)} · ${spl}/${SPLIT_CAP}` +
                            (splitBuy.count > 1 ? ` · +${splitBuy.count}` : "")}
                          cost={splitBuy.cost}
                          icon={<PixelIcon sprite={SPLIT_ICON} color={g.color} px={3} />}
                          onBuy={() => buy("split", g.id, selected("split", g.id))}
                          {...quantityProps("split", g.id, splitBuy.count)}
                          disabled={splitBuy.count === 0}
                          color={g.color}
                          nextCost={peekCost(state, "split", g.id)}
                          plasma={state.plasma}
                        />
                      </React.Fragment>
                    );
                  })}
                </>
              )}
              </div>
            </div>
  );
}
