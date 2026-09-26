import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseDomain } from '../src/domain.js';

const loadSample = async () => {
  const raw = await readFile(new URL('../fixtures/domain.json', import.meta.url), 'utf8');
  return parseDomain(raw);
};

test('样例领域标识正确', async () => {
  const value = await loadSample();
  assert.equal(value.domain, 'expo-public-capacity');
  assert.ok(value.constraints.length >= 2);
});

test('样例覆盖展馆、入口、通道、展项、演示时段和人员能力', async () => {
  const value = await loadSample();
  const zoneNames = value.zones.map((zone) => zone.name);
  assert.ok(zoneNames.includes('未来空间展区'));
  assert.ok(zoneNames.includes('东帝汶展馆'));
  assert.ok(value.entrances.length >= 1);
  assert.ok(value.corridors.length >= 1);
  const exhibitIds = new Set(value.exhibits.map((exhibit) => exhibit.id));
  assert.ok(value.demo_slots.length >= 1);
  for (const slot of value.demo_slots) {
    assert.ok(exhibitIds.has(slot.exhibit));
  }
  assert.ok(value.staff.some((member) => member.role === '指挥席'));
});

test('科普展示与零售分类并存，可上手AI商品不计入零售', async () => {
  const value = await loadSample();
  const categories = new Set(value.exhibits.map((exhibit) => exhibit.category));
  assert.ok(categories.has('科普展示'));
  assert.ok(categories.has('零售'));
  const aiHandsOn = value.exhibits.find((exhibit) => exhibit.name.includes('AI'));
  assert.equal(aiHandsOn.category, '科普展示');
});

test('关键约束覆盖幂等入场、封控引导、区域授权与统计口径', async () => {
  const value = await loadSample();
  const text = value.constraints.join('\n');
  assert.match(text, /扫码重试不得重复入场/);
  assert.match(text, /明确引导/);
  assert.match(text, /仅操作负责区域/);
  assert.match(text, /不计入零售订单/);
});

test('工作人员范围限定在已知展区，指挥席可跨区', async () => {
  const value = await loadSample();
  const zoneIds = new Set(value.zones.map((zone) => zone.id));
  for (const member of value.staff) {
    for (const id of member.scope) {
      assert.ok(id === '*' || zoneIds.has(id));
    }
  }
  const command = value.staff.find((member) => member.role === '指挥席');
  assert.deepEqual(command.scope, ['*']);
});

test('引用未知展区的样例会被拒绝', () => {
  const broken = {
    domain: 'expo-public-capacity',
    version: 2,
    sample_id: 'record-broken',
    actors: ['甲', '乙'],
    facts: ['事实一', '事实二'],
    constraints: ['约束一', '约束二'],
    zones: [{ id: 'zone-a', name: '展区甲', capacity: 100 }],
    entrances: [{ id: 'gate-a', name: '入口甲', zones: ['zone-a'] }],
    corridors: [{ id: 'corridor-a', from: 'zone-a', to: 'zone-ghost', capacity: 50 }],
    exhibits: [{ id: 'exhibit-a', zone: 'zone-a', name: '展项甲', interactive: true, category: '科普展示' }],
    demo_slots: [{ exhibit: 'exhibit-a', slot: '10:00-10:30', capacity: 20 }],
    staff: [{ role: '区域工作人员', scope: ['zone-a'], capabilities: ['排队管理'] }],
  };
  assert.throws(() => parseDomain(JSON.stringify(broken)), /未知展区、展项/);
});

test('演示时段引用未知展项的样例会被拒绝', async () => {
  const value = await loadSample();
  const broken = { ...value, demo_slots: [{ exhibit: 'exhibit-ghost', slot: '10:00-10:30', capacity: 20 }] };
  assert.throws(() => parseDomain(JSON.stringify(broken)), /未知展区、展项/);
});
