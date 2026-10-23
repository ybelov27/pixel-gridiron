// League data: the 32 real NFL cities in their real conferences/divisions and colours.
// Teams are labelled by city only (no nicknames or logos); the two-team cities carry their conference.
export const CONFS = ['AMERICAN', 'NATIONAL'];
export const CONF_ABBR = ['AFC', 'NFC'];
export const DIVS = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
// [city, tag, abbr, primary, secondary, dome, cold]
export const TEAM_DATA = [
  // AFC North
  ['BALTIMORE', '', 'BAL', '#241773', '#9e7c0c', 0, 1], ['CINCINNATI', '', 'CIN', '#fb4f14', '#111111', 0, 1],
  ['CLEVELAND', '', 'CLE', '#311d00', '#ff3c00', 0, 1], ['PITTSBURGH', '', 'PIT', '#1c1c1c', '#ffb612', 0, 1],
  // AFC South
  ['HOUSTON', '', 'HOU', '#03202f', '#a71930', 1, 0], ['INDIANAPOLIS', '', 'IND', '#002c5f', '#f4f4f4', 1, 0],
  ['JACKSONVILLE', '', 'JAX', '#006778', '#d7a22a', 0, 0], ['TENNESSEE', '', 'TEN', '#0c2340', '#4b92db', 0, 0],
  // AFC East
  ['BUFFALO', '', 'BUF', '#00338d', '#c60c30', 0, 1], ['MIAMI', '', 'MIA', '#008e97', '#fc4c02', 0, 0],
  ['NEW ENGLAND', '', 'NE', '#002244', '#c60c30', 0, 1], ['NEW YORK', 'AFC', 'NYA', '#125740', '#f4f4f4', 0, 1],
  // AFC West
  ['DENVER', '', 'DEN', '#fb4f14', '#002244', 0, 1], ['KANSAS CITY', '', 'KC', '#e31837', '#ffb81c', 0, 1],
  ['LAS VEGAS', '', 'LV', '#1c1c1c', '#a5acaf', 1, 0], ['LOS ANGELES', 'AFC', 'LAA', '#0080c6', '#ffc20e', 1, 0],
  // NFC North
  ['CHICAGO', '', 'CHI', '#0b162a', '#c83803', 0, 1], ['DETROIT', '', 'DET', '#0076b6', '#b0b7bc', 1, 0],
  ['GREEN BAY', '', 'GB', '#203731', '#ffb612', 0, 1], ['MINNESOTA', '', 'MIN', '#4f2683', '#ffc62f', 1, 0],
  // NFC South
  ['ATLANTA', '', 'ATL', '#a71930', '#1c1c1c', 1, 0], ['CAROLINA', '', 'CAR', '#0085ca', '#1c1c1c', 0, 0],
  ['NEW ORLEANS', '', 'NO', '#d3bc8d', '#1c1c1c', 1, 0], ['TAMPA BAY', '', 'TB', '#d50a0a', '#34302b', 0, 0],
  // NFC East
  ['DALLAS', '', 'DAL', '#003594', '#869397', 1, 0], ['NEW YORK', 'NFC', 'NYN', '#0b2265', '#a71930', 0, 1],
  ['PHILADELPHIA', '', 'PHI', '#004c54', '#a5acaf', 0, 1], ['WASHINGTON', '', 'WAS', '#5a1414', '#ffb612', 0, 1],
  // NFC West
  ['ARIZONA', '', 'ARI', '#97233f', '#f4f4f4', 1, 0], ['LOS ANGELES', 'NFC', 'LAN', '#003594', '#ffa300', 1, 0],
  ['SAN FRANCISCO', '', 'SF', '#aa0000', '#b3995d', 0, 0], ['SEATTLE', '', 'SEA', '#002244', '#69be28', 0, 0],
];
// the fictional league older saves were created with (same order), so careers can be converted in place
export const OLD_TEAMS = ['IRONPORT ANVILS', 'BAYSIDE BREAKERS', 'GRANITE FALLS GOATS', 'NORTHVALE OWLS', 'SUNHAVEN SCORCH', 'PINECREST LUMBERJACKS',
  'STORMRIDGE BOLTS', 'LAKEMONT LOONS', 'ASHFORD FOXES', 'SILVERTON MINERS', 'DUNMORE DRAGONS', 'CRESTWOOD KNIGHTS', 'EMBER BAY EMBERS',
  'FROSTBURG YETIS', 'GOLDCOAST MARLINS', 'HIGHMARK HAWKS', 'JUNIPER JACKALS', 'KINGSBRIDGE CROWNS', 'LOWELL POINT LIGHTHOUSE', 'MAPLE RIDGE MOOSE',
  'NEW AVALON TITANS', 'OAKHURST ACORNS', 'PORT ROWAN PIRATES', 'QUARRY HILL ROCKERS', 'RIVERTON OTTERS', 'SALTMARSH GATORS', 'THORNBURY THORNS',
  'VALEMONT VIPERS', 'WESTGATE WRANGLERS', 'YELLOWROCK BISON', 'COBALT CITY COMETS', 'REDMESA RATTLERS'];
export const OLD_ABBR = ['IRN', 'BAY', 'GRF', 'NVL', 'SUN', 'PIN', 'STR', 'LKM', 'ASH', 'SLV', 'DUN', 'CRW', 'EMB', 'FRB', 'GLD', 'HMK', 'JUN', 'KBR',
  'LWP', 'MPR', 'NAV', 'OAK', 'PRW', 'QRY', 'RIV', 'SLT', 'THB', 'VAL', 'WSG', 'YLR', 'CBC', 'RDM'];
export const FIRST = ['JAX','TREY','MARCUS','DEVON','KOFI','LIAM','NOAH','ELI','MILES','OWEN','RICO','DANTE','BEAU','CALEB','TATE',
  'ZEKE','JALEN','ANDRE','COLE','REID','SAMIR','THEO','IKE','HUGO','LEVI','NICO','OMAR','PAX','QUINN','RAFE','SETH','TY','VAN','WADE',
  'XAVI','YUSUF','ZANE','BRODY','CHASE','DARIUS','EMRYS','FINN','GRADY','HOLT','IVAN','JUDE','KAI','LANDO','MAX','NATE','ROMAN','SILAS','TOBIAS',
  'UMAR','VICTOR','WES','AMARI','BASH','CYRUS','DEX','ENZO','FELIX','GIO','HANK','ISAIAH','JONAH','KENJI','LUCA','MATEO','NASH','ORION','PIERCE'];
export const LAST = ['STONE','RIVERS','BLAKE','HOLLOWAY','OKAFOR','PRICE','MERCER','DALTON','KESTREL','FARROW','ABARA','VANCE','CROW','LINDQVIST',
  'MORROW','ACHTERBERG','BOATENG','CALLOWAY','DRUMMOND','ESPARZA','FONTAINE','GALLOWAY','HARGROVE','IBARRA','JEFFERIES','KOWALSKI','LACROIX',
  'MADDOX','NAKAMURA','OSEI','PENROSE','QUINTERO','ROOKWOOD','SATTERFIELD','THACKERAY','UDOH','VALENTI','WHITLOCK','YARBROUGH','ZELLER',
  'ASHBY','BRISCOE','CARVER','DUNLEAVY','ELLSWORTH','FAIRCHILD','GRIMES','HALVORSEN','IRWIN','JUNG','KILLIAN','LOCKHART','MBEKI','NORWOOD',
  'ODUYA','PARRISH','RADCLIFFE','SOLBERG','TANAKA','UPTON','VOSS','WAINWRIGHT','YOUNGBLOOD','ZIMMER','BELLAMY','CASTELLANOS','DEVEREAUX'];
export const COACH_FIRST = ['ART', 'BUD', 'CHUCK', 'DOT', 'EDIE', 'FRAN', 'GUS', 'HAL', 'IRMA', 'JUNE', 'KIT', 'LOU', 'MO', 'NELL', 'OTIS', 'PAT', 'ROZ', 'SAL', 'TESS', 'VERN'];
