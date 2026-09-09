// apps/api/scripts/test-aislamiento.ts
// LA PRUEBA QUE DEFINE SI ORSHUK ES VENDIBLE.
// Ejecutar con:  pnpm --filter api exec tsx scripts/test-aislamiento.ts
// Requiere que la API este corriendo en el puerto 4000.

const API = 'http://localhost:4000/api';

interface LoginResult { accessToken: string; user: { tenantId: string } }

async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login fallo para ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function get(path: string, token?: string) {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.text() };
}

let fallos = 0;
function check(nombre: string, ok: boolean, detalle = '') {
  console.log(`${ok ? '  OK  ' : ' FALLO'}  ${nombre}${detalle ? ' -> ' + detalle : ''}`);
  if (!ok) fallos++;
}

async function main() {
  console.log('\n=== Prueba de aislamiento multi-tenant ===\n');

  const esquina  = await login('admin@laesquina.sv',  'orshuk123');
  const tornillo = await login('admin@eltornillo.sv', 'orshuk123');

  check('Login tienda La Esquina', !!esquina.accessToken);
  check('Login Ferreteria El Tornillo', !!tornillo.accessToken);
  check('Los tenantId son distintos',
        esquina.user.tenantId !== tornillo.user.tenantId);

  // 1. Sin token no se pasa
  const anon = await get('/auth/me');
  check('Peticion sin token es rechazada', anon.status === 401, `status ${anon.status}`);

  // 2. Token invalido no se pasa
  const bad = await get('/auth/me', 'token.falso.invalido');
  check('Token invalido es rechazado', bad.status === 401, `status ${bad.status}`);

  // 3. Cada token devuelve solo su empresa
  const meEsquina  = await get('/auth/me', esquina.accessToken);
  const meTornillo = await get('/auth/me', tornillo.accessToken);
  check('La Esquina ve su propia empresa',
        meEsquina.body.includes('la-esquina') && !meEsquina.body.includes('el-tornillo'));
  check('El Tornillo ve su propia empresa',
        meTornillo.body.includes('el-tornillo') && !meTornillo.body.includes('la-esquina'));

  // 4. Los productos NO se cruzan (activar cuando exista /products)
  const prodEsquina  = await get('/products', esquina.accessToken);
  if (prodEsquina.status === 200) {
    check('La Esquina no ve productos del Tornillo',
          !prodEsquina.body.includes('Martillo'));
    const prodTornillo = await get('/products', tornillo.accessToken);
    check('El Tornillo no ve productos de La Esquina',
          !prodTornillo.body.includes('Coca-Cola'));
  } else {
    console.log('  ----  /products aun no existe, se omite (Semana 3)');
  }

  console.log(`\n=== ${fallos === 0 ? 'TODAS LAS PRUEBAS PASARON' : fallos + ' PRUEBA(S) FALLARON'} ===\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => { console.error('\nError:', err.message); process.exit(1); });
