import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/audit_output.json', 'utf8'));
const users = data.users;

console.log('=== TOP 35 SALDO RETIRABLE (Pasivo Real Retirable) ===');
const topWithdrawable = users.slice()
  .sort((a,b) => Number(b.withdrawable_gems) - Number(a.withdrawable_gems))
  .slice(0, 35);

topWithdrawable.forEach((u, i) => {
  const num = String(i + 1).padStart(2, ' ');
  const name = (u.username || 'Sin Nombre').padEnd(16, ' ');
  const total = Number(u.total_gems).toFixed(2).padStart(8, ' ');
  const ret = Number(u.withdrawable_gems).toFixed(2).padStart(8, ' ');
  const bloq = Number(u.locked_gems).toFixed(2).padStart(8, ' ');
  const oro = String(u.gold_balance).padStart(6, ' ');
  console.log(`${num}. ${name} | Retirable: ${ret} 💎 | Bloqueado: ${bloq} 💎 | Total: ${total} 💎 | Oro: ${oro}`);
});

console.log('\n=== TOP 25 SALDO NO RETIRABLE (Gemas de Juego / Bloqueadas) ===');
const topLocked = users.slice()
  .sort((a,b) => Number(b.locked_gems) - Number(a.locked_gems))
  .slice(0, 25);

topLocked.forEach((u, i) => {
  const num = String(i + 1).padStart(2, ' ');
  const name = (u.username || 'Sin Nombre').padEnd(16, ' ');
  const total = Number(u.total_gems).toFixed(2).padStart(8, ' ');
  const ret = Number(u.withdrawable_gems).toFixed(2).padStart(8, ' ');
  const bloq = Number(u.locked_gems).toFixed(2).padStart(8, ' ');
  const oro = String(u.gold_balance).padStart(6, ' ');
  console.log(`${num}. ${name} | Bloqueado: ${bloq} 💎 | Retirable: ${ret} 💎 | Total: ${total} 💎 | Oro: ${oro}`);
});

console.log('\n=== JUGADORES CON 100% SALDO NO RETIRABLE (Top 15) ===');
const onlyLocked = users
  .filter(u => Number(u.withdrawable_gems) === 0 && Number(u.locked_gems) > 0)
  .sort((a,b) => Number(b.locked_gems) - Number(a.locked_gems))
  .slice(0, 15);

onlyLocked.forEach((u, i) => {
  const num = String(i + 1).padStart(2, ' ');
  const name = (u.username || 'Sin Nombre').padEnd(16, ' ');
  const bloq = Number(u.locked_gems).toFixed(2).padStart(8, ' ');
  console.log(`${num}. ${name} | 100% Bloqueado: ${bloq} 💎`);
});
