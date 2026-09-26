// 读取并检查项目共享的领域资料。
const SAMPLE_SECTIONS = ['zones', 'entrances', 'corridors', 'exhibits', 'demo_slots', 'staff'];
const EXHIBIT_CATEGORIES = ['科普展示', '零售'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function isStringList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

export function parseDomain(raw) {
  const value = JSON.parse(raw);
  if (!value.domain || !value.version || !value.sample_id || !Array.isArray(value.actors) || value.actors.length < 2 || !Array.isArray(value.facts) || value.facts.length < 2 || !Array.isArray(value.constraints) || value.constraints.length < 2) {
    throw new Error('共享资料缺少必要字段');
  }
  for (const section of SAMPLE_SECTIONS) {
    if (!Array.isArray(value[section]) || value[section].length === 0) {
      throw new Error(`共享资料缺少${section}样例`);
    }
  }
  const zoneIds = new Set(value.zones.map((zone) => zone.id));
  const exhibitIds = new Set(value.exhibits.map((exhibit) => exhibit.id));
  const checks = [
    value.zones.every((zone) => isNonEmptyString(zone.id) && isNonEmptyString(zone.name) && isPositiveInt(zone.capacity)),
    value.entrances.every((entrance) => isNonEmptyString(entrance.id) && isNonEmptyString(entrance.name) && isStringList(entrance.zones) && entrance.zones.every((id) => zoneIds.has(id))),
    value.corridors.every((corridor) => isNonEmptyString(corridor.id) && zoneIds.has(corridor.from) && zoneIds.has(corridor.to) && isPositiveInt(corridor.capacity)),
    value.exhibits.every((exhibit) => isNonEmptyString(exhibit.id) && isNonEmptyString(exhibit.name) && zoneIds.has(exhibit.zone) && typeof exhibit.interactive === 'boolean' && EXHIBIT_CATEGORIES.includes(exhibit.category)),
    value.demo_slots.every((slot) => exhibitIds.has(slot.exhibit) && isNonEmptyString(slot.slot) && isPositiveInt(slot.capacity)),
    value.staff.every((member) => isNonEmptyString(member.role) && isStringList(member.scope) && member.scope.every((id) => id === '*' || zoneIds.has(id)) && isStringList(member.capabilities)),
  ];
  if (checks.some((ok) => !ok)) {
    throw new Error('承载样例字段不完整或引用了未知展区、展项');
  }
  return value;
}
