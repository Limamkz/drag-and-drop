// Aluno: Murilo de Lima Marques - Nº13
//https://css-tricks.com/creating-a-parking-game-with-the-html-drag-and-drop-api/

let dragged; //armazenar o objeto que está sendo arrastado
window['moment-range'].extendMoment(moment);

const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* Regras de estacionamento (conforme a tabela da atividade).
 * - days:    dias da semana em que o veículo pode estacionar
 * - times:   função que recebe o "agora" e devolve uma LISTA de intervalos
 *            permitidos. Se omitido, vale o dia todo (24h).
 * - blocked: proibições que se sobrepõem às permissões (usado pelo SUV)
 * - denied:  mensagem exibida quando o estacionamento é negado
 *
 * Os intervalos são montados a cada verificação (e não uma vez só ao carregar
 * a página) para continuarem corretos se a página ficar aberta por horas.
 */
const parkingRules = {
  ambulance: {
    days: allDays // todos os dias, 24h (sem "times" = livre o dia todo)
  },
  suv: {
    days: allDays, // livre, exceto quinta-feira das 7h às 12h (inversão da lógica)
    blocked: [
      { days: ['Thursday'], times: (now) => [hourRange(now, 7, 12)] }
    ],
    denied: 'Acesso negado: O SUV é proibido às quintas-feiras das 7h às 12h!'
  },
  car: {
    days: ['Monday'], // apenas segunda-feira
    times: (now) => [hourRange(now, 7, 20)], // 7h às 20h
    denied: 'Acesso negado: O carro só pode estacionar às segundas-feiras, das 7h às 20h!'
  },
  motorcycle: {
    days: allDays, // todos os dias
    times: (now) => [hourRange(now, 7, 20)], // 7h às 20h
    denied: 'Acesso negado: A moto só pode estacionar das 7h às 20h!'
  }
};

function createRange(start, end) {
  if (start && end) {
    return moment.range(start, end);
  }
}

/* Intervalo entre duas horas cheias do dia de "now".
 * Usa startOf('day') para zerar minutos/segundos (moment().set('hour', 7)
 * manteria os minutos atuais). hourRange(now, 18, 24) iria até a meia-noite.
 */
function hourRange(now, startHour, endHour) {
  const day = now.clone().startOf('day');
  return createRange(
    day.clone().add(startHour, 'hours'),
    day.clone().add(endHour, 'hours')
  );
}

function inAnyRange(ranges, now) {
  return ranges.some((range) => range.contains(now));
}

function onDragStart(event) {
  let target = event.target;
  if (target && target.nodeName === 'IMG') { // Se o alvo for uma imagem
    dragged = target;
    // Necessário para o drag-and-drop funcionar em alguns navegadores (Firefox)
    // e para o onDrop saber qual veículo foi solto
    event.dataTransfer.setData('text', target.id);
    // Torná-lo meio transparente
    event.target.style.opacity = .3;
  }
}

function onDragEnd(event) {
  if (event.target && event.target.nodeName === 'IMG') {
      // Redefinir a transparência
      event.target.style.opacity = '';
    dragged = null;
  }
}

function onDragOver(event) {
  // Impedir o padrão para permitir a queda
  event.preventDefault();
  event.dataTransfer.dropEffect = "move"
}

function onDragLeave(event) {
  event.target.style.background = '';
}

/* "Agora". Para testar dias/horários sem esperar, abra a página com
 * ?now=2026-09-24T09:00  (quinta-feira, 9h). Sem o parâmetro, usa a hora real.
 */
function getNow() {
  const simulated = new URLSearchParams(window.location.search).get('now');
  const now = simulated ? moment(simulated, moment.ISO_8601) : moment();
  return now.isValid() ? now : moment();
}

function getDay(now = getNow()) {
  return now.format('dddd'); // formatar como 'Monday', não 1
}

function canPark(vehicle) {
  /* Verifique a hora e o tipo de veículo que está sendo arrastado
   * para ver se ele pode estacionar neste momento
   */
  const rules = parkingRules[vehicle];
  if (!rules) {
    return false;
  }
  const now = getNow();
  const curDay = getDay(now);

  // 1) O dia atual precisa estar entre os dias permitidos
  if (!rules.days.includes(curDay)) {
    return false;
  }
  // 2) A hora atual precisa estar em algum intervalo permitido (se houver)
  /* Moment.range tem uma função contains que verifica
   * para ver se seu alcance contém um momento.
     https://github.com/rotaready/moment-range#contains
   */
  if (rules.times && !inAnyRange(rules.times(now), now)) {
    return false;
  }
  // 3) Nenhuma proibição pode estar ativa neste dia/horário (ex.: SUV às quintas, 7h-12h)
  if (rules.blocked) {
    const isBlocked = rules.blocked.some(
      (block) => block.days.includes(curDay) && inAnyRange(block.times(now), now)
    );
    if (isBlocked) {
      return false;
    }
  }
  return true;
}

/* Mensagem explicativa exibida abaixo da zona de soltar */
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + type; // 'success' ou 'error'
}

function deniedMessage(vehicle) {
  const rules = parkingRules[vehicle];
  return (rules && rules.denied) || 'Acesso negado: este veículo não pode estacionar agora!';
}

function onDragEnter(event) {
  const target = event.currentTarget; // a drop-zone (mesmo se o mouse estiver sobre um veículo dentro dela)
  if (dragged && target) {
    const vehicleType = dragged.alt; // por exemplo, moto, ambulância
    if (canPark(vehicleType)) {
      event.preventDefault();
      // Defina o dropEffect para mover
      event.dataTransfer.dropEffect = 'move';
      /* Mude a cor para verde para mostrar que pode
       * ser descartado
       */
      target.style.background = '#1f904e';
      showMessage('Pode estacionar: solte o veículo aqui.', 'success');
     }
    else {
    /* Muda a cor para vermelho para mostrar
       * não pode ser descartado. Observe que nós
       * não chame event.preventDefault() aqui
       * para que o navegador não permita uma queda
       * por padrão
       */
      target.style.backgroundColor = '#d51c00';
      showMessage(deniedMessage(vehicleType), 'error');
    }
  }
}

function onDrop(event) {
  const target = event.currentTarget;
  if (target) {
    const data = event.dataTransfer.getData('text');
    const dragged = document.getElementById(data);
    if (!dragged) {
      return;
    }
    const vehicleType = dragged.alt;
    target.style.background = '';
    if (canPark(vehicleType)) {
       event.preventDefault();
      // Obtém o id do alvo e adiciona o elemento movido ao DOM do alvo
       dragged.style.opacity = '';
       target.appendChild(dragged);
       showMessage('Estacionamento permitido com sucesso!', 'success');
    }
    else {
       showMessage(deniedMessage(vehicleType), 'error');
    }
  }
}

const vehicles = document.querySelector('.vehicles');
const dropZone = document.querySelector('.drop-zone');
const messageEl = document.getElementById('message');

// Adicionando ouvintes de evento
vehicles.addEventListener('dragstart', onDragStart);
vehicles.addEventListener('dragend', onDragEnd);
dropZone.addEventListener('drop', onDrop);
dropZone.addEventListener('dragenter', onDragEnter);
dropZone.addEventListener('dragleave', onDragLeave);
dropZone.addEventListener('dragover', onDragOver);
