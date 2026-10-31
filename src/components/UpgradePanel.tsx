/** UI-only upgrade tabs; the App shell still owns purchases and persistence. */
import React from "react";
import UpgradeRow, { type BuyQuantity } from "./UpgradeRow";
import InfoRow from "./InfoRow";
import PixelIcon from "./PixelIcon";
import { nextGas } from "../game/gases";
import { SPLIT_CAP, STICKMAN_MULT, fmtVolts, splitMult, voltMult } from "../game/config";
import { bulkCost, canAfford, cracklePower, peekCost } from "../game/economy";
import type { BuyKind } from "../game/economy";
import { fmt } from "../utils/format";
import { FINGER_SPRITE, FOOT_SPRITE, GHOST_SPRITE, STICKMAN_SPRITE, GAS_ICON, FIL_ICON, VOLT_ICON, SPLIT_ICON } from "../render/sprites";
import { SKIN, SKIN_PALETTE, GHOST_PALETTE } from "../render/palette";
import type { Gas, GasId, GameState } from "../game/types";

const STICKMAN_PALETTE = { "0": "#20152e", "1": "#fff2c7", "2": "#ff9d2e" };

export type UpTab = "help" | "gas" | "power";

export default function UpgradePanel({ state, unlockedGases, accent, upTab, onUpTabChange, quantities, onQuantityChange, onBuy }: {
  state: GameState; unlockedGases: Gas[]; accent: string;
  upTab: UpTab; onUpTabChange: (tab: UpTab) => void;
  quantities: Record<string, BuyQuantity>;
  onQuantityChange: (key: string, quantity: BuyQuantity) => void;
  onBuy: (kind: BuyKind, gid?: GasId, quantity?: BuyQuantity) => void;
}) {
  const rowKey = (kind: BuyKind, gid?: GasId) => gid ? `${kind}:${gid}` : kind;
  const selected = (kind: BuyKind, gid?: GasId): BuyQuantity =>
    quantities[rowKey(kind, gid)] ?? 1;
  const quote = (kind: BuyKind, gid?: GasId) => {
    const quantity = selected(kind, gid);
    return bulkCost(state, kind, gid, quantity === "max" ? 1000 : quantity);
  };
  const quantityProps = (kind: BuyKind, gid?: GasId) => ({
    quantity: selected(kind, gid),
    onQtyChange: (value: BuyQuantity) => onQuantityChange(rowKey(kind, gid), value),
  });
  const fingerBuy = quote("finger");
  const toeBuy = quote("toe");
  const ghostBuy = quote("ghost");
  const stickBuy = quote("stickman");
  const argonUnlocked = state.unlocked.includes("argon");
  const xenonUnlocked = state.unlocked.includes("xenon");
  const kryptonUnlocked = state.unlocked.includes("krypton");
  const nxGas = nextGas(state.unlocked);

  // afford dots for sub-tabs (shown only on tabs you're NOT looking at)
  const powerKinds: BuyKind[] = ["filament", "voltage", "split"];
  const subDots: Record<UpTab, boolean> = {
    help:
      fingerBuy.count > 0 || (argonUnlocked && toeBuy.count > 0) ||
      (xenonUnlocked && ghostBuy.count > 0) ||
      (kryptonUnlocked && stickBuy.count > 0),
    gas: !!nxGas && canAfford(state, nxGas.unlockCost),
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
                    ["gas", "GAS"],
                    ["power", "POWER"],
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
                  <UpgradeRow
                    name="FINGER"
                    sub={`ALL GASES · OWN ${state.fingers}` +
                      (fingerBuy.count > 1 ? ` · +${fingerBuy.count}` : "")}
                    cost={fingerBuy.cost}
                    icon={<PixelIcon sprite={FINGER_SPRITE} palette={SKIN_PALETTE} px={2} />}
                    onBuy={() => buy("finger", undefined, selected("finger"))}
                    {...quantityProps("finger")}
                    disabled={fingerBuy.count === 0}
                    nextCost={peekCost(state, "finger")}
                          plasma={state.plasma}
                  />
                  {argonUnlocked
                    ? <UpgradeRow
                        name="BIG TOE"
                        sub={`8× FINGER · OWN ${state.toes}` +
                          (toeBuy.count > 1 ? ` · +${toeBuy.count}` : "")}
                        cost={toeBuy.cost}
                        icon={<PixelIcon sprite={FOOT_SPRITE} palette={SKIN_PALETTE} px={3} />}
                        onBuy={() => buy("toe", undefined, selected("toe"))}
                    {...quantityProps("toe")}
                        disabled={toeBuy.count === 0}
                        color={SKIN}
                        nextCost={peekCost(state, "toe")}
                          plasma={state.plasma}
                      />
                    : (
                      <React.Fragment>
                        <UpgradeRow
                          name="BIG TOE"
                          sub="UNLOCKS WITH ARGON GAS"
                          cost={{ argon: 15 }}
                          icon={<PixelIcon sprite={FOOT_SPRITE} palette={SKIN_PALETTE} px={3} />}
                          onBuy={() => {}}
                          disabled
                          locked
                          plasma={state.plasma}
                          unlockCost={nxGas?.unlockCost}
                        />
                      </React.Fragment>
                    )}
                  {xenonUnlocked
                    ? <UpgradeRow
                        name="GHOST HAND"
                        sub={`20× FINGER · OWN ${state.ghosts}` +
                          (ghostBuy.count > 1 ? ` · +${ghostBuy.count}` : "")}
                        cost={ghostBuy.cost}
                        icon={<PixelIcon sprite={GHOST_SPRITE} palette={GHOST_PALETTE} px={3} />}
                        onBuy={() => buy("ghost", undefined, selected("ghost"))}
                    {...quantityProps("ghost")}
                        disabled={ghostBuy.count === 0}
                        color="#b7b2ff"
                        nextCost={peekCost(state, "ghost")}
                          plasma={state.plasma}
                      />
                    : (
                      <React.Fragment>
                        <UpgradeRow
                          name="GHOST HAND"
                          sub="UNLOCKS WITH XENON GAS"
                          cost={{ xenon: 80 }}
                          icon={<PixelIcon sprite={GHOST_SPRITE} palette={GHOST_PALETTE} px={3} />}
                          onBuy={() => {}}
                          disabled
                          locked
                          plasma={state.plasma}
                          unlockCost={nxGas?.unlockCost}
                        />
                      </React.Fragment>
                    )}
                  {kryptonUnlocked
                    ? <UpgradeRow
                        name="STICKMAN"
                        sub={`${STICKMAN_MULT}× FINGER · OWN ${state.stickmen}` +
                          (stickBuy.count > 1 ? ` · +${stickBuy.count}` : "")}
                        cost={stickBuy.cost}
                        icon={<PixelIcon sprite={STICKMAN_SPRITE} palette={STICKMAN_PALETTE} px={3} />}
                        onBuy={() => buy("stickman", undefined, selected("stickman"))}
                        {...quantityProps("stickman")}
                        disabled={stickBuy.count === 0}
                        color="#ffd166"
                        nextCost={peekCost(state, "stickman")}
                        plasma={state.plasma}
                      />
                    : <UpgradeRow
                        name="STICKMAN"
                        sub="UNLOCKS WITH KRYPTON GAS"
                        cost={{ krypton: 120 }}
                        icon={<PixelIcon sprite={STICKMAN_SPRITE} palette={STICKMAN_PALETTE} px={3} />}
                        onBuy={() => {}}
                        disabled
                        locked
                        plasma={state.plasma}
                        unlockCost={nxGas?.unlockCost}
                      />}
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
                  {nxGas
                    ? (
                      <React.Fragment>
                        <UpgradeRow
                          name={`${nxGas.name} GAS`}
                          sub={`NEW CURRENCY · ${fmt(nxGas.baseRate)}/TAP BASE`}
                          cost={nxGas.unlockCost}
                          icon={<PixelIcon sprite={GAS_ICON} color={nxGas.color} px={3} />}
                          onBuy={() => buy("gas")}
                          disabled={!canAfford(state, nxGas.unlockCost)}
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
                          {...quantityProps("filament", g.id)}
                          disabled={filBuy.count === 0}
                          color={g.color}
                          nextCost={peekCost(state, "filament", g.id)}
                          plasma={state.plasma}
                        />
                        <UpgradeRow
                          name={`${g.name} VOLTS`}
                          sub={`+0.0001V · ${fmtVolts(steps)} · X${voltMult(steps).toFixed(4)}` +
                            (voltBuy.count > 1 ? ` · +${voltBuy.count} STEPS` : "")}
                          cost={voltBuy.cost}
                          icon={<PixelIcon sprite={VOLT_ICON} color={g.color} px={3} />}
                          onBuy={() => buy("voltage", g.id, selected("voltage", g.id))}
                          {...quantityProps("voltage", g.id)}
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
                          {...quantityProps("split", g.id)}
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
