// Orders: the order board. Orders arrive on a schedule, wait with a
// draining patience bar, and pay coins plus a patience bonus when served.
// Losing an order resets the combo streak.

NB.newOrder = function (state) {
  const dish = NB.DISHES[Math.floor(state.rng() * NB.DISHES.length)];
  const rush = state.timeLeft <= NB.RUSH_AT;
  const patienceMax = rush ? NB.PATIENCE_RUSH : NB.PATIENCE_EARLY;
  const order = {
    id: state.nextOrderId++,
    dishId: dish.id,
    needs: dish.needs.map(function (n) {
      return { ing: n.ing, prep: n.prep, done: false };
    }),
    patience: patienceMax,
    patienceMax: patienceMax,
    value: dish.coins
  };
  return order;
};

// How many coins an order pays right now: base value plus up to 6 for
// serving it while its patience is still high.
NB.orderPayout = function (order, combo) {
  const patienceBonus = Math.round(6 * (order.patience / order.patienceMax));
  const mult = Math.min(2, 1 + 0.1 * combo);
  return Math.round((order.value + patienceBonus) * mult);
};

NB.spawnInterval = function (state) {
  if (state.timeLeft <= NB.RUSH_AT) return NB.SPAWN_RUSH;
  if (state.elapsed > 60) return NB.SPAWN_MID;
  return NB.SPAWN_EARLY;
};

NB.updateOrders = function (state, dt) {
  // Spawn new orders while there is room on the board.
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    state.spawnIn = NB.spawnInterval(state);
    if (state.orders.length < NB.MAX_ORDERS) {
      state.orders.push(NB.newOrder(state));
    }
  }
  // Drain patience; an order that runs out is lost.
  for (let i = state.orders.length - 1; i >= 0; i--) {
    const order = state.orders[i];
    order.patience -= dt;
    if (order.patience <= 0) {
      state.orders.splice(i, 1);
      state.lost += 1;
      state.combo = 0;
      NB.addToast(state, 'Order lost: ' + NB.dishById(order.dishId).name, '#e5484d');
      NB.playSound('lost');
      if (state.plateFor === order.id) NB.clearPlate(state);
    }
  }
};

// The oldest active order that still needs this exact item on the plate.
NB.orderNeeding = function (state, item) {
  for (const order of state.orders) {
    if (state.plateFor !== null && state.plateFor !== order.id) continue;
    const slot = order.needs.find(function (n) {
      return n.ing === item.ing && n.prep === item.prep && !n.done;
    });
    if (slot) return { order: order, slot: slot };
  }
  return null;
};

// Is the plate finished for the order it is building?
NB.plateComplete = function (state) {
  if (state.plateFor === null) return false;
  const order = state.orders.find(function (o) { return o.id === state.plateFor; });
  if (!order) return false;
  return order.needs.every(function (n) { return n.done; });
};

NB.servePlate = function (state) {
  const order = state.orders.find(function (o) { return o.id === state.plateFor; });
  if (!order || !NB.plateComplete(state)) return 0;
  const pay = NB.orderPayout(order, state.combo);
  state.coins += pay;
  state.served += 1;
  state.combo += 1;
  if (state.combo > state.bestCombo) state.bestCombo = state.combo;
  state.orders.splice(state.orders.indexOf(order), 1);
  NB.clearPlate(state);
  NB.addToast(state, '+' + pay + ' coins — ' + NB.dishById(order.dishId).name + ' served!', '#ffd166');
  NB.burst(state, 1130, 180, '#ffd166', 14);
  NB.playSound('serve');
  return pay;
};
