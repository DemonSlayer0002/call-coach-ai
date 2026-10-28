export const SCENARIOS = {
  price: { name: 'Jordan', vehicle: '2021 Toyota RAV4', turns: [
    ['rep', 'What matters most in your next vehicle?'],
    ['customer', 'We need an SUV for our family. I like the RAV4, but your price is higher than another one I found.'],
    ['rep', 'What is the biggest difference between the two offers for you?'],
    ['customer', 'Theirs is about two thousand less. I need to understand why I should spend more.'],
    ['rep', 'I’ve checked the two written quotes. The lower quote excludes fees. Let’s compare the complete totals.'],
    ['customer', 'Now that I see both totals, that resolves my price concern. Twenty-four thousand five hundred fits our budget, and we need a car this month.'],
    ['rep', 'Who will be coming with you to look at the vehicle?'],
    ['customer', 'My wife and I want to test drive it. Could we come Saturday at ten?'],
  ] },
  history: { name: 'Morgan', vehicle: '2020 Honda CR-V', turns: [
    ['rep', 'What would you like to know about the CR-V?'],
    ['customer', 'I like it, but I’m worried about the accident history. I won’t come in until I can see a report.'],
    ['rep', 'Which part of the history would you most like to verify?'],
    ['customer', 'Whether there was structural damage, and what repairs were done. I need something reliable for my commute.'],
    ['rep', 'I will check what history and inspection records are available. I won’t guess about its condition.'],
    ['customer', 'Thank you. Is an independent inspection something I can arrange?'],
    ['rep', 'I’ll confirm the inspection options with the dealership and get back to you.'],
    ['customer', 'Please call tomorrow afternoon once you have the records. I am interested, but I need those answers first.'],
  ] },
  visit: { name: 'Alex', vehicle: '2022 Toyota Camry', turns: [
    ['rep', 'Tell me a little about what you are looking for.'],
    ['customer', 'A reliable sedan for commuting. The Camry looks right, and I want to buy this week.'],
    ['rep', 'What would be helpful to confirm before a visit?'],
    ['customer', 'Is that exact Camry still available, and what is the total price with taxes and fees?'],
    ['rep', 'I have checked the exact Camry: it is available. The written out-the-door total is twenty-three thousand eight hundred.'],
    ['customer', 'That total works for me. I want to come drive it. Do you have an opening tomorrow?'],
    ['rep', 'We can offer tomorrow at ten in the morning or two in the afternoon.'],
    ['customer', 'Ten tomorrow morning works. Please book that time for my partner and me.'],
  ] },
};

export function createDemoPlayer({ onTurn, onState = () => {}, delayMs = 2600 }) {
  let turns = [], index = 0, playing = false, generation = 0, timer, wake;
  const state = () => ({ index, total: turns.length, playing, finished: index >= turns.length });
  function pause() { generation++; playing = false; clearTimeout(timer); wake?.(); wake = null; onState(state()); }
  function load(scenario) { pause(); turns = scenario.turns; index = 0; onState(state()); }
  async function step() { if (index >= turns.length) return; const [speaker, text] = turns[index++]; onState(state()); await onTurn({ speaker, text }); }
  async function play() {
    if (playing) { pause(); return; }
    const token = ++generation; playing = true; onState(state());
    while (token === generation && index < turns.length) {
      await step();
      if (token !== generation || index >= turns.length) break;
      await new Promise(resolve => { wake = resolve; timer = setTimeout(resolve, delayMs); });
    }
    if (token === generation) { playing = false; onState(state()); }
  }
  return { load, step, play, pause, state };
}
