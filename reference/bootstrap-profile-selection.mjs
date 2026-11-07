// Research-only selection. No checkpoint authentication.
const fail = () => {
  const e = new Error('BOOTSTRAP_PROFILE_REJECTED');
  e.code = 'BOOTSTRAP_PROFILE_REJECTED';
  throw e;
};

const hex32 = x =>
  typeof x === 'string' &&
  /^0x[0-9a-f]{64}$/.test(x) &&
  !/^0x0{64}$/.test(x);

const exact = (obj, keys) =>
  obj !== null &&
  typeof obj === 'object' &&
  !Array.isArray(obj) &&
  Object.keys(obj).length === keys.length &&
  keys.every(k => Object.hasOwn(obj, k));

export function selectResearchBootstrap(p) {
  if (!exact(p, [
    'schema','network','profile',
    'selectedBeaconRoot','anchor'
  ])) fail();

  if (
    p.schema !== 'caw-bootstrap-selection/1' ||
    p.network !== 'ethereum-minimal-capella-fixture' ||
    p.profile !== 'minimal-capella-32-structural-only' ||
    !hex32(p.selectedBeaconRoot)
  ) fail();

  if (!exact(p.anchor, [
    'source','beaconRoot','sha256'
  ])) fail();

  if (
    p.anchor.source !==
      'externally-retained-fixture-metadata' ||
    !hex32(p.anchor.beaconRoot) ||
    p.anchor.beaconRoot !== p.selectedBeaconRoot ||
    !/^[0-9a-f]{64}$/.test(p.anchor.sha256)
  ) fail();

  return Object.freeze({
    schema:'caw-bootstrap-selection-result/1',
    fixtureProfileSelected:true,
    selectedBeaconRoot:p.selectedBeaconRoot,
    rootAuthenticated:false,
    independentAcquisitionVerified:false,
    blsValidated:false,
    updatesAccepted:false,
    finalityVerified:false,
    productionAccepted:false
  });
}
