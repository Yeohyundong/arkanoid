import {
  balance,
  DEFAULT_BALANCE,
  saveBalanceSnapshot,
  clearBalanceSnapshot,
  hasSavedSnapshot,
} from '../game/Balance';
import type { BalanceParams } from '../game/Balance';
import { HEAT_TIERS, resetHeatTiers } from '../game/Heat';

interface ParamDef {
  key: keyof BalanceParams;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
  unit?: string;
}

const LIVE_PARAMS: ParamDef[] = [
  { group: 'Ball',  key: 'ballSpeedStep',        label: 'Speed Step',        min: 0,    max: 60,    step: 1 },
  { group: 'Ball',  key: 'ballMaxSpeed',         label: 'Max Speed',         min: 400,  max: 1500,  step: 20 },

  { group: 'Items', key: 'fireballDurationMs',   label: 'Fireball',          min: 1000, max: 15000, step: 250, unit: 'ms' },
  { group: 'Items', key: 'laserDurationMs',      label: 'Laser',             min: 1000, max: 15000, step: 250, unit: 'ms' },
  { group: 'Items', key: 'enlargeDurationMs',    label: 'Enlarge',           min: 2000, max: 20000, step: 250, unit: 'ms' },
  { group: 'Items', key: 'heatBoostStacks',      label: 'Heat Boost (H)',    min: 1,    max: 50,    step: 1,   unit: 'stk' },

  { group: 'Spawn', key: 'itemSpawnIntervalMs',  label: 'Spawn Interval',    min: 500,  max: 15000, step: 250, unit: 'ms' },
  { group: 'Spawn', key: 'itemBlockLifetimeMs',  label: 'Block Lifetime',    min: 2000, max: 30000, step: 500, unit: 'ms' },

  { group: 'Score', key: 'extraLifeStackStep',   label: '1UP Stack Step',    min: 10,   max: 200,   step: 5 },
  { group: 'Score', key: 'brickScore',           label: 'Brick Score Base',  min: 1,    max: 100,   step: 1 },
];

const LOBBY_LIFE_PARAMS: ParamDef[] = [
  { group: 'Lives', key: 'arcadeStartingLives',  label: 'Starting Lives',    min: 1,    max: 5,     step: 1 },
  { group: 'Lives', key: 'arcadeMaxLives',       label: 'Max Lives',         min: 1,    max: 10,    step: 1 },
];

const HEAT_FIELDS: { field: 'minStack' | 'mult' | 'damage'; label: string; min: number; max: number; step: number }[] = [
  { field: 'minStack', label: 'Stack', min: 0,  max: 100, step: 1 },
  { field: 'mult',     label: 'Mult',  min: 1,  max: 10,  step: 1 },
  { field: 'damage',   label: 'Dmg',   min: 1,  max: 5,   step: 1 },
];

// === LIVE DASHBOARD ===

export function mountLiveDashboard(parent: HTMLElement): void {
  const aside = document.createElement('aside');
  aside.id = 'balance-dashboard-live';
  aside.classList.add('balance-dashboard');

  appendTitle(aside, 'Live Dashboard', 'DEV ONLY · always visible');

  const inputs = appendParamSection(aside, LIVE_PARAMS);

  appendResetButton(aside, () => {
    for (const def of LIVE_PARAMS) balance[def.key] = DEFAULT_BALANCE[def.key];
    refreshInputs(inputs);
  });
  appendPersistButtons(aside);

  parent.appendChild(aside);
}

// === LOBBY DASHBOARD ===

export function mountLobbyDashboard(parent: HTMLElement): { setVisible: (v: boolean) => void } {
  const aside = document.createElement('aside');
  aside.id = 'balance-dashboard-lobby';
  aside.classList.add('balance-dashboard');

  appendTitle(aside, 'Lobby Dashboard', 'Heat tiers · lives · lobby only');

  const heatInputs = appendHeatTable(aside);
  const paramInputs = appendParamSection(aside, LOBBY_LIFE_PARAMS);

  appendResetButton(aside, () => {
    for (const def of LOBBY_LIFE_PARAMS) balance[def.key] = DEFAULT_BALANCE[def.key];
    resetHeatTiers();
    refreshInputs(paramInputs);
    refreshHeatInputs(heatInputs);
  });
  appendPersistButtons(aside);

  parent.insertBefore(aside, parent.firstChild);

  return {
    setVisible(v: boolean): void {
      aside.classList.toggle('is-hidden', !v);
    },
  };
}

// === Helpers ===

interface ParamInputRecord {
  def: ParamDef;
  range: HTMLInputElement;
  numberInput: HTMLInputElement;
}

function appendTitle(aside: HTMLElement, title: string, subtitle: string): void {
  const h = document.createElement('h3');
  h.textContent = title;
  aside.appendChild(h);
  const sub = document.createElement('p');
  sub.className = 'dashboard-subtitle';
  sub.textContent = subtitle;
  aside.appendChild(sub);
}

function appendParamSection(aside: HTMLElement, params: ParamDef[]): ParamInputRecord[] {
  const records: ParamInputRecord[] = [];
  let currentGroup = '';
  for (const def of params) {
    if (def.group !== currentGroup) {
      currentGroup = def.group;
      const h = document.createElement('h4');
      h.textContent = def.group;
      aside.appendChild(h);
    }
    const rec = buildParamRow(def);
    aside.appendChild(rec.row);
    records.push({ def, range: rec.range, numberInput: rec.numberInput });
  }
  return records;
}

function appendHeatTable(aside: HTMLElement): HTMLInputElement[] {
  const h = document.createElement('h4');
  h.textContent = 'Heat Tiers';
  aside.appendChild(h);

  const table = document.createElement('div');
  table.className = 'heat-table';

  // header row
  table.appendChild(headerCell(''));
  for (const f of HEAT_FIELDS) table.appendChild(headerCell(f.label));

  const inputs: HTMLInputElement[] = [];
  for (let tierIdx = 0; tierIdx < HEAT_TIERS.length; tierIdx++) {
    const tier = HEAT_TIERS[tierIdx];

    const nameCell = document.createElement('div');
    nameCell.className = 'heat-name';
    nameCell.style.color = tier.color;
    nameCell.textContent = tier.name;
    table.appendChild(nameCell);

    for (const f of HEAT_FIELDS) {
      const cell = document.createElement('div');
      cell.className = 'heat-cell';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = String(f.min);
      input.max = String(f.max);
      input.step = String(f.step);
      input.value = String(tier[f.field]);
      input.dataset.tier = String(tierIdx);
      input.dataset.field = f.field;
      input.addEventListener('input', () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        HEAT_TIERS[tierIdx][f.field] = v;
      });
      cell.appendChild(input);
      table.appendChild(cell);
      inputs.push(input);
    }
  }

  aside.appendChild(table);
  return inputs;
}

function refreshHeatInputs(inputs: HTMLInputElement[]): void {
  for (const input of inputs) {
    const tierIdx = Number(input.dataset.tier);
    const field = input.dataset.field as 'minStack' | 'mult' | 'damage';
    input.value = String(HEAT_TIERS[tierIdx][field]);
  }
}

function refreshInputs(records: ParamInputRecord[]): void {
  for (const r of records) {
    const v = String(balance[r.def.key]);
    r.range.value = v;
    r.numberInput.value = v;
  }
}

function appendResetButton(aside: HTMLElement, onClick: () => void): void {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Reset to defaults';
  btn.className = 'dashboard-reset';
  btn.addEventListener('click', onClick);
  aside.appendChild(btn);
}

function appendPersistButtons(aside: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.className = 'dashboard-persist';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save preset';
  saveBtn.className = 'dashboard-save';
  saveBtn.title = 'Save current balance + heat values to localStorage. Auto-applied on next reload.';

  const forgetBtn = document.createElement('button');
  forgetBtn.type = 'button';
  forgetBtn.textContent = 'Forget saved';
  forgetBtn.className = 'dashboard-forget';
  forgetBtn.title = 'Remove the saved preset from localStorage.';

  const updateForgetState = (): void => {
    forgetBtn.disabled = !hasSavedSnapshot();
  };

  saveBtn.addEventListener('click', () => {
    const ok = saveBalanceSnapshot();
    flashButton(saveBtn, ok ? 'Saved!' : 'Failed', 'Save preset');
    updateForgetState();
  });

  forgetBtn.addEventListener('click', () => {
    clearBalanceSnapshot();
    flashButton(forgetBtn, 'Forgotten', 'Forget saved');
    updateForgetState();
  });

  updateForgetState();

  wrap.appendChild(saveBtn);
  wrap.appendChild(forgetBtn);
  aside.appendChild(wrap);
}

function flashButton(btn: HTMLButtonElement, tempText: string, restoreText: string): void {
  btn.textContent = tempText;
  btn.classList.add('is-flash');
  setTimeout(() => {
    btn.textContent = restoreText;
    btn.classList.remove('is-flash');
  }, 1200);
}

function headerCell(text: string): HTMLDivElement {
  const cell = document.createElement('div');
  cell.className = 'heat-header';
  cell.textContent = text;
  return cell;
}

function buildParamRow(def: ParamDef): { row: HTMLDivElement; range: HTMLInputElement; numberInput: HTMLInputElement } {
  const row = document.createElement('div');
  row.className = 'param-row';

  const labelLine = document.createElement('div');
  labelLine.className = 'param-label-line';
  const label = document.createElement('label');
  label.textContent = def.label;

  const valueGroup = document.createElement('div');
  valueGroup.className = 'value-group';
  const numberInput = document.createElement('input');
  numberInput.type = 'number';
  numberInput.className = 'value-input';
  numberInput.min = String(def.min);
  numberInput.max = String(def.max);
  numberInput.step = String(def.step);
  numberInput.value = String(balance[def.key]);
  valueGroup.appendChild(numberInput);
  if (def.unit) {
    const unitEl = document.createElement('span');
    unitEl.className = 'value-unit';
    unitEl.textContent = def.unit;
    valueGroup.appendChild(unitEl);
  }

  labelLine.appendChild(label);
  labelLine.appendChild(valueGroup);

  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(def.min);
  range.max = String(def.max);
  range.step = String(def.step);
  range.value = String(balance[def.key]);
  range.dataset.key = def.key;

  const apply = (raw: number, syncSource: 'range' | 'number'): void => {
    if (!Number.isFinite(raw)) return;
    const clamped = Math.min(def.max, Math.max(def.min, raw));
    balance[def.key] = clamped;
    if (syncSource !== 'range') range.value = String(clamped);
    if (syncSource !== 'number') numberInput.value = String(clamped);
  };

  range.addEventListener('input', () => apply(Number(range.value), 'range'));
  numberInput.addEventListener('input', () => apply(Number(numberInput.value), 'number'));
  numberInput.addEventListener('blur', () => {
    numberInput.value = String(balance[def.key]);
  });

  row.appendChild(labelLine);
  row.appendChild(range);
  return { row, range, numberInput };
}
