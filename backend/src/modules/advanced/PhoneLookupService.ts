import { Op } from 'sequelize';
import { sequelize } from '../../database/index.js';
import { Contact, Conversation } from '../../database/models/index.js';

export interface PhoneLookupResult {
  raw: string;
  cleaned: string;
  isBrazilian: boolean;
  country: {
    name: string;
    code: string;
    ddi: string;
    flag: string;
  };
  ddd?: string;
  state?: {
    code: string;
    name: string;
    region: string;
  };
  regionName?: string;
  capitalCity?: string;
  hubCity?: string;
  approximateAddress?: string;
  probableCarrier?: string;
  mainCities?: string[];
  allCities?: string[];
  carrierType?: 'mobile' | 'landline' | 'special';
  formattedNational?: string;
  formattedInternational?: string;
  hasNinthDigit?: boolean;
  waMeLink: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  // Automatic LID resolution fields
  isResolvedFromLid?: boolean;
  originalLid?: string;
  resolvedName?: string;
  resolvedJid?: string;
  realPhoneNumber?: string;
}

const BRAZILIAN_STATES: Record<string, { name: string; region: string; capital: string; lat: number; lng: number }> = {
  SP: { name: 'São Paulo', region: 'Sudeste', capital: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  RJ: { name: 'Rio de Janeiro', region: 'Sudeste', capital: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
  ES: { name: 'Espírito Santo', region: 'Sudeste', capital: 'Vitória', lat: -20.3155, lng: -40.3128 },
  MG: { name: 'Minas Gerais', region: 'Sudeste', capital: 'Belo Horizonte', lat: -19.9167, lng: -43.9345 },
  PR: { name: 'Paraná', region: 'Sul', capital: 'Curitiba', lat: -25.4284, lng: -49.2733 },
  SC: { name: 'Santa Catarina', region: 'Sul', capital: 'Florianópolis', lat: -27.5954, lng: -48.548 },
  RS: { name: 'Rio Grande do Sul', region: 'Sul', capital: 'Porto Alegre', lat: -30.0346, lng: -51.2177 },
  DF: { name: 'Distrito Federal', region: 'Centro-Oeste', capital: 'Brasília', lat: -15.7975, lng: -47.8919 },
  GO: { name: 'Goiás', region: 'Centro-Oeste', capital: 'Goiânia', lat: -16.6869, lng: -49.2648 },
  TO: { name: 'Tocantins', region: 'Norte', capital: 'Palmas', lat: -10.2491, lng: -48.3243 },
  MT: { name: 'Mato Grosso', region: 'Centro-Oeste', capital: 'Cuiabá', lat: -15.6014, lng: -56.0979 },
  MS: { name: 'Mato Grosso do Sul', region: 'Centro-Oeste', capital: 'Campo Grande', lat: -20.4697, lng: -54.6201 },
  AC: { name: 'Acre', region: 'Norte', capital: 'Rio Branco', lat: -9.9754, lng: -67.8249 },
  RO: { name: 'Rondônia', region: 'Norte', capital: 'Porto Velho', lat: -8.7619, lng: -63.9039 },
  BA: { name: 'Bahia', region: 'Nordeste', capital: 'Salvador', lat: -12.9777, lng: -38.5016 },
  SE: { name: 'Sergipe', region: 'Nordeste', capital: 'Aracaju', lat: -10.9472, lng: -37.0731 },
  PE: { name: 'Pernambuco', region: 'Nordeste', capital: 'Recife', lat: -8.0476, lng: -34.877 },
  AL: { name: 'Alagoas', region: 'Nordeste', capital: 'Maceió', lat: -9.6498, lng: -35.7089 },
  PB: { name: 'Paraíba', region: 'Nordeste', capital: 'João Pessoa', lat: -7.1195, lng: -34.845 },
  RN: { name: 'Rio Grande do Norte', region: 'Nordeste', capital: 'Natal', lat: -5.7945, lng: -35.211 },
  CE: { name: 'Ceará', region: 'Nordeste', capital: 'Fortaleza', lat: -3.7172, lng: -38.5433 },
  PI: { name: 'Piauí', region: 'Nordeste', capital: 'Teresina', lat: -5.092, lng: -42.8038 },
  PA: { name: 'Pará', region: 'Norte', capital: 'Belém', lat: -1.4558, lng: -48.4902 },
  AM: { name: 'Amazonas', region: 'Norte', capital: 'Manaus', lat: -3.119, lng: -60.0217 },
  RR: { name: 'Roraima', region: 'Norte', capital: 'Boa Vista', lat: 2.8235, lng: -60.6758 },
  AP: { name: 'Amapá', region: 'Norte', capital: 'Macapá', lat: 0.0356, lng: -51.0705 },
  MA: { name: 'Maranhão', region: 'Nordeste', capital: 'São Luís', lat: -2.5307, lng: -44.3068 },
};

interface DddConfig {
  uf: string;
  name: string;
  mainCities: string[];
  hubCity: string;
  lat: number;
  lng: number;
  carriers: string[];
}

const DDD_MAP: Record<string, DddConfig> = {
  '11': { uf: 'SP', name: 'São Paulo e Região Metropolitana', mainCities: ['São Paulo', 'Guarulhos', 'São Bernardo', 'Santo André', 'Osasco'], hubCity: 'São Paulo', lat: -23.5505, lng: -46.6333, carriers: ['Vivo', 'Claro', 'TIM'] },
  '12': { uf: 'SP', name: 'Vale do Paraíba e Litoral Norte', mainCities: ['São José dos Campos', 'Taubaté', 'Jacareí', 'Ubatuba'], hubCity: 'São José dos Campos', lat: -23.1896, lng: -45.8841, carriers: ['Vivo', 'Claro', 'TIM'] },
  '13': { uf: 'SP', name: 'Baixada Santista e Litoral Sul', mainCities: ['Santos', 'São Vicente', 'Praia Grande', 'Guarujá'], hubCity: 'Santos', lat: -23.9608, lng: -46.3336, carriers: ['Vivo', 'Claro', 'TIM'] },
  '14': { uf: 'SP', name: 'Bauru, Marília, Jaú e Botucatu', mainCities: ['Bauru', 'Marília', 'Jaú', 'Botucatu', 'Lençóis Paulista'], hubCity: 'Bauru', lat: -22.3145, lng: -49.0587, carriers: ['Vivo', 'Claro', 'TIM'] },
  '15': { uf: 'SP', name: 'Sorocaba e Itapetininga', mainCities: ['Sorocaba', 'Itapetininga', 'Itapeva', 'Tatuí'], hubCity: 'Sorocaba', lat: -23.5015, lng: -47.4526, carriers: ['Vivo', 'Claro', 'TIM'] },
  '16': { uf: 'SP', name: 'Ribeirão Preto, Franca e São Carlos', mainCities: ['Ribeirão Preto', 'Franca', 'São Carlos', 'Araraquara'], hubCity: 'Ribeirão Preto', lat: -21.1767, lng: -47.8108, carriers: ['Claro', 'Vivo', 'TIM'] },
  '17': { uf: 'SP', name: 'São José do Rio Preto e Barretos', mainCities: ['São José do Rio Preto', 'Barretos', 'Catanduva', 'Votuporanga'], hubCity: 'São José do Rio Preto', lat: -20.8113, lng: -49.3758, carriers: ['Vivo', 'Claro', 'TIM'] },
  '18': { uf: 'SP', name: 'Presidente Prudente e Araçatuba', mainCities: ['Presidente Prudente', 'Araçatuba', 'Birigui', 'Assis'], hubCity: 'Presidente Prudente', lat: -22.1225, lng: -51.3856, carriers: ['Vivo', 'Claro', 'TIM'] },
  '19': { uf: 'SP', name: 'Campinas, Piracicaba e Limeira', mainCities: ['Campinas', 'Piracicaba', 'Limeira', 'Americana', 'Sumaré'], hubCity: 'Campinas', lat: -22.9056, lng: -47.0608, carriers: ['Claro', 'Vivo', 'TIM'] },
  '21': { uf: 'RJ', name: 'Rio de Janeiro e Região Metropolitana', mainCities: ['Rio de Janeiro', 'Niterói', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu'], hubCity: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729, carriers: ['Claro', 'TIM', 'Vivo'] },
  '22': { uf: 'RJ', name: 'Região dos Lagos e Norte Fluminense', mainCities: ['Campos dos Goytacazes', 'Macaé', 'Cabo Frio', 'Nova Friburgo'], hubCity: 'Campos dos Goytacazes', lat: -21.7545, lng: -41.3244, carriers: ['Vivo', 'Claro', 'TIM'] },
  '24': { uf: 'RJ', name: 'Região Serrana e Sul Fluminense', mainCities: ['Volta Redonda', 'Petrópolis', 'Angra dos Reis', 'Resende', 'Barra Mansa'], hubCity: 'Volta Redonda', lat: -22.5202, lng: -44.1041, carriers: ['Claro', 'Vivo', 'TIM'] },
  '27': { uf: 'ES', name: 'Vitória e Região Metropolitana / Norte', mainCities: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Linhares'], hubCity: 'Vitória', lat: -20.3155, lng: -40.3128, carriers: ['Vivo', 'Claro', 'TIM'] },
  '28': { uf: 'ES', name: 'Sul do Espírito Santo', mainCities: ['Cachoeiro de Itapemirim', 'Marataízes', 'Guarapari', 'Castelo'], hubCity: 'Cachoeiro de Itapemirim', lat: -20.8489, lng: -41.1128, carriers: ['Vivo', 'Claro', 'TIM'] },
  '31': { uf: 'MG', name: 'Belo Horizonte e Região Central / Vale do Aço', mainCities: ['Belo Horizonte', 'Contagem', 'Betim', 'Ipatinga', 'Coronel Fabriciano'], hubCity: 'Belo Horizonte', lat: -19.9167, lng: -43.9345, carriers: ['Claro', 'Vivo', 'TIM'] },
  '32': { uf: 'MG', name: 'Juiz de Fora e Zona da Mata', mainCities: ['Juiz de Fora', 'Barbacena', 'Muriaé', 'Ubá', 'São João del-Rei'], hubCity: 'Juiz de Fora', lat: -21.7642, lng: -43.3496, carriers: ['Claro', 'Vivo', 'TIM'] },
  '33': { uf: 'MG', name: 'Governador Valadares e Leste Mineiro', mainCities: ['Governador Valadares', 'Teófilo Otoni', 'Caratinga', 'Manhuaçu'], hubCity: 'Governador Valadares', lat: -18.8511, lng: -41.9494, carriers: ['Vivo', 'Claro', 'TIM'] },
  '34': { uf: 'MG', name: 'Triângulo Mineiro e Alto Paranaíba', mainCities: ['Uberlândia', 'Uberaba', 'Patos de Minas', 'Araguari', 'Araxá', 'Ituiutaba'], hubCity: 'Uberlândia', lat: -18.9186, lng: -48.2772, carriers: ['Algar Telecom (CTBC)', 'Vivo', 'Claro', 'TIM'] },
  '35': { uf: 'MG', name: 'Sul de Minas Gerais', mainCities: ['Poços de Caldas', 'Pouso Alegre', 'Varginha', 'Passos', 'Itajubá', 'Lavras'], hubCity: 'Poços de Caldas', lat: -21.7877, lng: -46.5614, carriers: ['Vivo', 'Claro', 'TIM'] },
  '37': { uf: 'MG', name: 'Centro-Oeste de Minas Gerais', mainCities: ['Divinópolis', 'Itaúna', 'Formiga', 'Nova Serrana', 'Pará de Minas'], hubCity: 'Divinópolis', lat: -20.1444, lng: -44.8911, carriers: ['Vivo', 'Claro', 'TIM'] },
  '38': { uf: 'MG', name: 'Norte e Noroeste de Minas Gerais', mainCities: ['Montes Claros', 'Diamantina', 'Pirapora', 'Unaí', 'Paracatu'], hubCity: 'Montes Claros', lat: -16.7350, lng: -43.8617, carriers: ['Vivo', 'Claro', 'TIM'] },
  '41': { uf: 'PR', name: 'Curitiba e Região Metropolitana', mainCities: ['Curitiba', 'São José dos Pinhais', 'Colombo', 'Araucária', 'Paranaguá'], hubCity: 'Curitiba', lat: -25.4284, lng: -49.2733, carriers: ['TIM', 'Claro', 'Vivo'] },
  '42': { uf: 'PR', name: 'Campos Gerais e Centro-Sul', mainCities: ['Ponta Grossa', 'Guarapuava', 'Castro', 'Telêmaco Borba'], hubCity: 'Ponta Grossa', lat: -25.0994, lng: -50.1583, carriers: ['TIM', 'Claro', 'Vivo'] },
  '43': { uf: 'PR', name: 'Londrina e Norte do Paraná', mainCities: ['Londrina', 'Apucarana', 'Arapongas', 'Cornélio Procópio'], hubCity: 'Londrina', lat: -23.3045, lng: -51.1696, carriers: ['TIM', 'Claro', 'Vivo'] },
  '44': { uf: 'PR', name: 'Maringá e Noroeste do Paraná', mainCities: ['Maringá', 'Campo Mourão', 'Paranavaí', 'Umuarama', 'Cianorte'], hubCity: 'Maringá', lat: -23.4210, lng: -51.9331, carriers: ['TIM', 'Claro', 'Vivo'] },
  '45': { uf: 'PR', name: 'Foz do Iguaçu e Oeste do Paraná', mainCities: ['Foz do Iguaçu', 'Cascavel', 'Toledo', 'Medianeira'], hubCity: 'Cascavel', lat: -24.9578, lng: -53.4595, carriers: ['TIM', 'Claro', 'Vivo'] },
  '46': { uf: 'PR', name: 'Sudoeste do Paraná', mainCities: ['Francisco Beltrão', 'Pato Branco', 'Dois Vizinhos', 'Palmas'], hubCity: 'Francisco Beltrão', lat: -26.0792, lng: -53.0544, carriers: ['TIM', 'Claro', 'Vivo'] },
  '47': { uf: 'SC', name: 'Joinville, Blumenau e Litoral Norte', mainCities: ['Joinville', 'Blumenau', 'Itajaí', 'Balneário Camboriú', 'Brusque'], hubCity: 'Joinville', lat: -26.3045, lng: -48.8487, carriers: ['TIM', 'Claro', 'Vivo'] },
  '48': { uf: 'SC', name: 'Florianópolis e Sul Catarinense', mainCities: ['Florianópolis', 'São José', 'Palhoça', 'Criciúma', 'Tubarão'], hubCity: 'Florianópolis', lat: -27.5954, lng: -48.5480, carriers: ['TIM', 'Claro', 'Vivo'] },
  '49': { uf: 'SC', name: 'Oeste e Planalto Catarinense', mainCities: ['Chapecó', 'Lages', 'Concórdia', 'Caçador', 'Joaçaba'], hubCity: 'Chapecó', lat: -27.1004, lng: -52.6152, carriers: ['TIM', 'Claro', 'Vivo'] },
  '51': { uf: 'RS', name: 'Porto Alegre e Região Metropolitana', mainCities: ['Porto Alegre', 'Canoas', 'Novo Hamburgo', 'São Leopoldo', 'Gravataí'], hubCity: 'Porto Alegre', lat: -30.0346, lng: -51.2177, carriers: ['Claro', 'Vivo', 'TIM'] },
  '53': { uf: 'RS', name: 'Pelotas e Sul Gaúcho', mainCities: ['Pelotas', 'Rio Grande', 'Bagé', 'Santana do Livramento'], hubCity: 'Pelotas', lat: -31.7654, lng: -52.3376, carriers: ['Claro', 'Vivo', 'TIM'] },
  '54': { uf: 'RS', name: 'Serra Gaúcha e Norte do RS', mainCities: ['Caxias do Sul', 'Passo Fundo', 'Bento Gonçalves', 'Erechim'], hubCity: 'Caxias do Sul', lat: -29.1678, lng: -51.1794, carriers: ['Vivo', 'Claro', 'TIM'] },
  '55': { uf: 'RS', name: 'Santa Maria e Centro-Oeste Gaúcho', mainCities: ['Santa Maria', 'Uruguaiana', 'Ijuí', 'Cruz Alta', 'Santo Ângelo'], hubCity: 'Santa Maria', lat: -29.6842, lng: -53.8069, carriers: ['Vivo', 'Claro', 'TIM'] },
  '61': { uf: 'DF', name: 'Brasília e Entorno do DF', mainCities: ['Brasília', 'Taguatinga', 'Ceilândia', 'Águas Lindas de Goiás', 'Valparaíso'], hubCity: 'Brasília', lat: -15.7975, lng: -47.8919, carriers: ['Claro', 'Vivo', 'TIM'] },
  '62': { uf: 'GO', name: 'Goiânia e Região Central / Norte de Goiás', mainCities: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Itaberaí'], hubCity: 'Goiânia', lat: -16.6869, lng: -49.2648, carriers: ['Claro', 'Vivo', 'TIM'] },
  '63': { uf: 'TO', name: 'Tocantins (Todo o Estado)', mainCities: ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional'], hubCity: 'Palmas', lat: -10.2491, lng: -48.3243, carriers: ['Claro', 'Vivo', 'TIM'] },
  '64': { uf: 'GO', name: 'Sul e Sudoeste de Goiás', mainCities: ['Rio Verde', 'Itumbiara', 'Jataí', 'Caldas Novas', 'Catalão'], hubCity: 'Rio Verde', lat: -17.7924, lng: -50.9192, carriers: ['Claro', 'Vivo', 'TIM'] },
  '65': { uf: 'MT', name: 'Cuiabá e Baixada Cuiabana', mainCities: ['Cuiabá', 'Várzea Grande', 'Cáceres', 'Tangará da Serra'], hubCity: 'Cuiabá', lat: -15.6014, lng: -56.0979, carriers: ['Vivo', 'Claro', 'TIM'] },
  '66': { uf: 'MT', name: 'Rondonópolis e Norte/Leste de MT', mainCities: ['Rondonópolis', 'Sinop', 'Sorriso', 'Lucas do Rio Verde', 'Barra do Garças'], hubCity: 'Rondonópolis', lat: -16.4674, lng: -54.6361, carriers: ['Vivo', 'Claro', 'TIM'] },
  '67': { uf: 'MS', name: 'Mato Grosso do Sul (Todo o Estado)', mainCities: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã'], hubCity: 'Campo Grande', lat: -20.4697, lng: -54.6201, carriers: ['Vivo', 'Claro', 'TIM'] },
  '68': { uf: 'AC', name: 'Acre (Todo o Estado)', mainCities: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá'], hubCity: 'Rio Branco', lat: -9.9754, lng: -67.8249, carriers: ['Vivo', 'Claro'] },
  '69': { uf: 'RO', name: 'Rondônia (Todo o Estado)', mainCities: ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal'], hubCity: 'Porto Velho', lat: -8.7619, lng: -63.9039, carriers: ['Vivo', 'Claro', 'TIM'] },
  '71': { uf: 'BA', name: 'Salvador e Região Metropolitana', mainCities: ['Salvador', 'Camaçari', 'Lauro de Freitas', 'Simões Filho', 'Candeias'], hubCity: 'Salvador', lat: -12.9777, lng: -38.5016, carriers: ['Claro', 'TIM', 'Vivo'] },
  '73': { uf: 'BA', name: 'Sul e Extremo Sul da Bahia', mainCities: ['Ilhéus', 'Itabuna', 'Porto Seguro', 'Teixeira de Freitas', 'Eunápolis'], hubCity: 'Ilhéus', lat: -14.7889, lng: -39.0494, carriers: ['Claro', 'Vivo', 'TIM'] },
  '74': { uf: 'BA', name: 'Juazeiro e Centro-Norte Baiano', mainCities: ['Juazeiro', 'Senhor do Bonfim', 'Jacobina', 'Irecê'], hubCity: 'Juazeiro', lat: -9.4167, lng: -40.5000, carriers: ['Claro', 'Vivo', 'TIM'] },
  '75': { uf: 'BA', name: 'Feira de Santana e Recôncavo Baiano', mainCities: ['Feira de Santana', 'Alagoinhas', 'Santo Antônio de Jesus', 'Valença'], hubCity: 'Feira de Santana', lat: -12.2664, lng: -38.9663, carriers: ['Claro', 'Vivo', 'TIM'] },
  '77': { uf: 'BA', name: 'Vitória da Conquista e Oeste Baiano', mainCities: ['Vitória da Conquista', 'Barreiras', 'Luís Eduardo Magalhães', 'Jequié'], hubCity: 'Vitória da Conquista', lat: -14.8661, lng: -40.8394, carriers: ['Claro', 'Vivo', 'TIM'] },
  '79': { uf: 'SE', name: 'Sergipe (Todo o Estado)', mainCities: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'Estância'], hubCity: 'Aracaju', lat: -10.9472, lng: -37.0731, carriers: ['Vivo', 'Claro', 'TIM'] },
  '81': { uf: 'PE', name: 'Recife e Região Metropolitana / Zona da Mata', mainCities: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Paulista', 'Vitória de Santo Antão'], hubCity: 'Recife', lat: -8.0476, lng: -34.8770, carriers: ['TIM', 'Claro', 'Vivo'] },
  '82': { uf: 'AL', name: 'Alagoas (Todo o Estado)', mainCities: ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios', 'União dos Palmares'], hubCity: 'Maceió', lat: -9.6498, lng: -35.7089, carriers: ['TIM', 'Claro', 'Vivo'] },
  '83': { uf: 'PB', name: 'Paraíba (Todo o Estado)', mainCities: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa'], hubCity: 'João Pessoa', lat: -7.1195, lng: -34.8450, carriers: ['TIM', 'Claro', 'Vivo'] },
  '84': { uf: 'RN', name: 'Rio Grande do Norte (Todo o Estado)', mainCities: ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Caicó'], hubCity: 'Natal', lat: -5.7945, lng: -35.2110, carriers: ['TIM', 'Claro', 'Vivo'] },
  '85': { uf: 'CE', name: 'Fortaleza e Região Metropolitana', mainCities: ['Fortaleza', 'Caucaia', 'Maracanaú', 'Sobral', 'São Gonçalo do Amarante'], hubCity: 'Fortaleza', lat: -3.7172, lng: -38.5433, carriers: ['Claro', 'TIM', 'Vivo'] },
  '86': { uf: 'PI', name: 'Teresina e Norte do Piauí', mainCities: ['Teresina', 'Parnaíba', 'Campo Maior', 'Piripiri', 'Barras'], hubCity: 'Teresina', lat: -5.0920, lng: -42.8038, carriers: ['Claro', 'TIM', 'Vivo'] },
  '87': { uf: 'PE', name: 'Sertão e Agreste Pernambucano', mainCities: ['Caruaru', 'Petrolina', 'Garanhuns', 'Serra Talhada', 'Arcoverde'], hubCity: 'Caruaru', lat: -8.2831, lng: -35.9761, carriers: ['TIM', 'Claro', 'Vivo'] },
  '88': { uf: 'CE', name: 'Juazeiro do Norte e Sul do Ceará', mainCities: ['Juazeiro do Norte', 'Crato', 'Barbalha', 'Iguatu', 'Quixadá'], hubCity: 'Juazeiro do Norte', lat: -7.2033, lng: -39.3156, carriers: ['Claro', 'TIM', 'Vivo'] },
  '89': { uf: 'PI', name: 'Sul e Sudeste do Piauí', mainCities: ['Picos', 'Floriano', 'São Raimundo Nonato', 'Corrente'], hubCity: 'Picos', lat: -7.0772, lng: -41.4672, carriers: ['Claro', 'TIM', 'Vivo'] },
  '91': { uf: 'PA', name: 'Belém e Região Metropolitana', mainCities: ['Belém', 'Ananindeua', 'Castanhal', 'Abaetetuba', 'Barcarena'], hubCity: 'Belém', lat: -1.4558, lng: -48.4902, carriers: ['Claro', 'TIM', 'Vivo'] },
  '92': { uf: 'AM', name: 'Manaus e Região Metropolitana', mainCities: ['Manaus', 'Itacoatiara', 'Manacapuru', 'Parintins', 'Coari'], hubCity: 'Manaus', lat: -3.1190, lng: -60.0217, carriers: ['Vivo', 'Claro', 'TIM'] },
  '93': { uf: 'PA', name: 'Santarém e Baixo Amazonas', mainCities: ['Santarém', 'Altamira', 'Itaituba', 'Oriximiná'], hubCity: 'Santarém', lat: -2.4431, lng: -54.7083, carriers: ['Claro', 'Vivo'] },
  '94': { uf: 'PA', name: 'Marabá e Sudeste do Pará', mainCities: ['Marabá', 'Parauapebas', 'Tucuruí', 'Redenção', 'Canaã dos Carajás'], hubCity: 'Marabá', lat: -5.3686, lng: -49.1178, carriers: ['Claro', 'TIM', 'Vivo'] },
  '95': { uf: 'RR', name: 'Roraima (Todo o Estado)', mainCities: ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Pacaraima'], hubCity: 'Boa Vista', lat: 2.8235, lng: -60.6758, carriers: ['Vivo', 'Claro'] },
  '96': { uf: 'AP', name: 'Amapá (Todo o Estado)', mainCities: ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque'], hubCity: 'Macapá', lat: 0.0356, lng: -51.0705, carriers: ['Vivo', 'Claro'] },
  '97': { uf: 'AM', name: 'Interior e Oeste do Amazonas', mainCities: ['Tefé', 'Tabatinga', 'São Gabriel da Cachoeira', 'Eirunepé', 'Lábrea'], hubCity: 'Tefé', lat: -3.3547, lng: -64.7119, carriers: ['Vivo', 'Claro'] },
  '98': { uf: 'MA', name: 'São Luís e Região Metropolitana', mainCities: ['São Luís', 'São José de Ribamar', 'Timon', 'Paço do Lumiar', 'Pinheiro'], hubCity: 'São Luís', lat: -2.5307, lng: -44.3068, carriers: ['Claro', 'Vivo', 'TIM'] },
  '99': { uf: 'MA', name: 'Imperatriz e Sul do Maranhão', mainCities: ['Imperatriz', 'Caxias', 'Codó', 'Açailândia', 'Bacabal', 'Balsas'], hubCity: 'Imperatriz', lat: -5.5266, lng: -47.4789, carriers: ['Claro', 'Vivo', 'TIM'] },
};

const INTERNATIONAL_PREFIXES: Array<{ prefix: string; name: string; code: string; flag: string }> = [
  { prefix: '1', name: 'Estados Unidos / Canadá', code: 'US', flag: '🇺🇸' },
  { prefix: '351', name: 'Portugal', code: 'PT', flag: '🇵🇹' },
  { prefix: '34', name: 'Espanha', code: 'ES', flag: '🇪🇸' },
  { prefix: '44', name: 'Reino Unido', code: 'GB', flag: '🇬🇧' },
  { prefix: '49', name: 'Alemanha', code: 'DE', flag: '🇩🇪' },
  { prefix: '33', name: 'França', code: 'FR', flag: '🇫🇷' },
  { prefix: '39', name: 'Itália', code: 'IT', flag: '🇮🇹' },
  { prefix: '54', name: 'Argentina', code: 'AR', flag: '🇦🇷' },
  { prefix: '598', name: 'Uruguai', code: 'UY', flag: '🇺🇾' },
  { prefix: '595', name: 'Paraguai', code: 'PY', flag: '🇵🇾' },
  { prefix: '56', name: 'Chile', code: 'CL', flag: '🇨🇱' },
  { prefix: '57', name: 'Colômbia', code: 'CO', flag: '🇨🇴' },
  { prefix: '52', name: 'México', code: 'MX', flag: '🇲🇽' },
  { prefix: '81', name: 'Japão', code: 'JP', flag: '🇯🇵' },
  { prefix: '86', name: 'China', code: 'CN', flag: '🇨🇳' },
  { prefix: '91', name: 'Índia', code: 'IN', flag: '🇮🇳' },
  { prefix: '7', name: 'Rússia / Cazaquistão', code: 'RU', flag: '🇷🇺' },
  { prefix: '61', name: 'Austrália', code: 'AU', flag: '🇦🇺' },
];

export class PhoneLookupService {
  private static citiesCache = new Map<string, string[]>();

  /**
   * Resolve um LID ou JID para o número real de telefone e nome no WhatsApp
   */
  public static async resolveLidOrContact(rawInput: string, connectionId?: string): Promise<{
    realNumber?: string;
    name?: string;
    lid?: string;
    jid?: string;
    isLid: boolean;
  }> {
    const clean = String(rawInput || '').trim();
    const digitsOnly = clean.replace(/\D/g, '');
    const isExplicitLid = clean.endsWith('@lid') || clean.includes('@lid');
    const isLikelyLidDigits = digitsOnly.length >= 13 && (digitsOnly.startsWith('978') || digitsOnly.startsWith('979') || digitsOnly.length === 14);

    // 1. Tentar mapeamento em wa_mailbox_contacts
    try {
      const [rows]: any = await sequelize.query(
        `SELECT jid, lid, phone_number, display_name, push_name 
         FROM wa_mailbox_contacts 
         WHERE lid = :q OR lid LIKE :qPattern OR jid = :q OR jid LIKE :qPattern OR phone_number LIKE :qPattern 
         LIMIT 1`,
        {
          replacements: {
            q: clean,
            qPattern: `%${digitsOnly}%`,
          },
        }
      );

      if (rows && rows.length > 0) {
        const r = rows[0];
        const rawPhone = r.phone_number || (r.jid && r.jid.endsWith('@s.whatsapp.net') ? r.jid : '');
        const realPhone = rawPhone.replace(/\D/g, '');
        const foundLid = r.lid || (r.jid && r.jid.endsWith('@lid') ? r.jid : undefined);
        const contactName = r.display_name || r.push_name || undefined;

        if (realPhone && realPhone !== digitsOnly) {
          return {
            realNumber: realPhone,
            name: contactName,
            lid: foundLid || clean,
            jid: rawPhone.includes('@') ? rawPhone : `${realPhone}@s.whatsapp.net`,
            isLid: true,
          };
        } else if (contactName) {
          return {
            realNumber: realPhone || digitsOnly,
            name: contactName,
            lid: foundLid,
            jid: r.jid,
            isLid: isExplicitLid || isLikelyLidDigits,
          };
        }
      }
    } catch {
      // Ignora falha de SQL
    }

    // 2. Tentar tabela de Contatos
    try {
      const contact = await Contact.findOne({
        where: {
          [Op.or]: [
            { jid: clean },
            { jid: { [Op.like]: `%${digitsOnly}%` } },
          ],
        },
      });
      if (contact) {
        const phone = contact.jid.replace(/\D/g, '');
        return {
          realNumber: phone,
          name: contact.name || contact.notifyName || undefined,
          lid: isExplicitLid ? clean : undefined,
          jid: contact.jid,
          isLid: isExplicitLid || isLikelyLidDigits,
        };
      }
    } catch {}

    // 3. Tentar tabela de Conversas
    try {
      const conv = await Conversation.findOne({
        where: {
          [Op.or]: [
            { jid: clean },
            { jid: { [Op.like]: `%${digitsOnly}%` } },
          ],
        },
      });
      if (conv) {
        const isLidConv = conv.jid.endsWith('@lid');
        if (!isLidConv) {
          return {
            realNumber: conv.jid.replace(/\D/g, ''),
            name: conv.name || undefined,
            lid: undefined,
            jid: conv.jid,
            isLid: false,
          };
        }
      }
    } catch {}

    return {
      realNumber: digitsOnly,
      isLid: isExplicitLid || isLikelyLidDigits,
    };
  }

  public static async lookup(rawInput: string, connectionId?: string): Promise<PhoneLookupResult> {
    const rawClean = String(rawInput || '').trim();
    if (!rawClean) {
      throw new Error('Número de telefone inválido ou vazio.');
    }

    // Resolve se é um LID ou busca nome associado
    const resolution = await this.resolveLidOrContact(rawClean, connectionId);

    const targetNumber = resolution.realNumber || rawClean.replace(/\D/g, '');
    const cleaned = targetNumber.replace(/\D/g, '');

    if (!cleaned) {
      throw new Error('Não foi possível identificar dígitos numéricos válidos.');
    }

    // Identificar se é Brasileiro
    let isBrazilian = false;
    let nationalNumber = cleaned;

    if (cleaned.startsWith('55') && cleaned.length >= 12 && cleaned.length <= 13) {
      isBrazilian = true;
      nationalNumber = cleaned.slice(2);
    } else if (cleaned.length === 10 || cleaned.length === 11) {
      // Usuário digitou DDD + Número sem 55
      const potentialDdd = cleaned.slice(0, 2);
      if (DDD_MAP[potentialDdd]) {
        isBrazilian = true;
        nationalNumber = cleaned;
      }
    }

    if (isBrazilian) {
      const ddd = nationalNumber.slice(0, 2);
      const numberPart = nationalNumber.slice(2);
      const dddInfo = DDD_MAP[ddd];
      const stateCode = dddInfo?.uf || 'SP';
      const stateData = BRAZILIAN_STATES[stateCode];

      const isMobile = numberPart.length === 9 || (numberPart.length === 8 && ['9', '8', '7'].includes(numberPart[0]));
      const hasNinthDigit = numberPart.length === 9 && numberPart.startsWith('9');

      // Buscar cidades via BrasilAPI se disponível com cache
      let allCities = dddInfo ? [...dddInfo.mainCities] : [];
      try {
        if (!this.citiesCache.has(ddd)) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1800);
          const res = await fetch(`https://brasilapi.com.br/api/ddd/v1/${ddd}`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            const data: any = await res.json();
            if (Array.isArray(data.cities) && data.cities.length > 0) {
              const formatted = data.cities.map(
                (c: string) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
              );
              this.citiesCache.set(ddd, formatted);
              allCities = formatted;
            }
          }
        } else {
          allCities = this.citiesCache.get(ddd)!;
        }
      } catch {
        // Fallback para lista estática
      }

      const formattedNational = `(${ddd}) ${numberPart.length === 9 ? `${numberPart.slice(0, 5)}-${numberPart.slice(5)}` : `${numberPart.slice(0, 4)}-${numberPart.slice(4)}`}`;
      const full55 = `55${ddd}${numberPart}`;

      const hubCity = dddInfo?.hubCity || dddInfo?.mainCities[0] || stateData?.capital || 'Capital Regional';
      const coordinates = dddInfo
        ? { lat: dddInfo.lat, lng: dddInfo.lng }
        : stateData
        ? { lat: stateData.lat, lng: stateData.lng }
        : undefined;

      const approximateAddress = `${hubCity} - ${stateCode}, Brasil (${dddInfo?.name || stateData?.name || 'Região'})`;
      const probableCarrier = dddInfo ? dddInfo.carriers.join(' / ') : 'Operadoras Nacionais (Vivo / Claro / TIM)';

      return {
        raw: rawInput,
        cleaned: full55,
        isBrazilian: true,
        country: {
          name: 'Brasil',
          code: 'BR',
          ddi: '+55',
          flag: '🇧🇷',
        },
        ddd,
        state: {
          code: stateCode,
          name: stateData?.name || stateCode,
          region: stateData?.region || 'Desconhecida',
        },
        regionName: dddInfo?.name || stateData?.name || 'Brasil',
        capitalCity: stateData?.capital,
        hubCity,
        approximateAddress,
        probableCarrier,
        mainCities: dddInfo?.mainCities || allCities.slice(0, 6),
        allCities: allCities.slice(0, 60),
        carrierType: isMobile ? 'mobile' : 'landline',
        formattedNational,
        formattedInternational: `+55 ${formattedNational}`,
        hasNinthDigit,
        waMeLink: `https://wa.me/${full55}`,
        coordinates,
        // Informações resolvidas de LID
        isResolvedFromLid: resolution.isLid,
        originalLid: resolution.lid,
        resolvedName: resolution.name,
        resolvedJid: resolution.jid,
        realPhoneNumber: resolution.realNumber ? `55${ddd}${numberPart}` : undefined,
      };
    }

    // Consulta Internacional
    let matchedCountry = { prefix: '', name: 'Internacional', code: 'INT', flag: '🌐' };
    for (const item of INTERNATIONAL_PREFIXES) {
      if (cleaned.startsWith(item.prefix)) {
        matchedCountry = item;
        break;
      }
    }

    return {
      raw: rawInput,
      cleaned,
      isBrazilian: false,
      country: {
        name: matchedCountry.name,
        code: matchedCountry.code,
        ddi: matchedCountry.prefix ? `+${matchedCountry.prefix}` : '',
        flag: matchedCountry.flag,
      },
      carrierType: 'special',
      formattedInternational: `+${cleaned}`,
      waMeLink: `https://wa.me/${cleaned}`,
      isResolvedFromLid: resolution.isLid,
      originalLid: resolution.lid,
      resolvedName: resolution.name,
      resolvedJid: resolution.jid,
    };
  }
}
