//SELECT ELEMENTS
const balanceEl = document.querySelector(".balance .value");
const incomeTotalEl = document.querySelector(".income-total");
const outcomeTotalEl = document.querySelector(".outcome-total");
const incomeEl = document.querySelector("#income");
const expenseEl = document.querySelector("#expense");
const allEl = document.querySelector("#all");
const incomeList = document.querySelector("#income .list");
const expenseList = document.querySelector("#expense .list");
const allList = document.querySelector("#all .list");

//SELECT BUTTONS
const expenseBtn = document.querySelector(".first-tab");
const incomeBtn = document.querySelector(".second-tab");
const allBtn = document.querySelector(".third-tab");

//INPUT BTS
const addExpense = document.querySelector(".add-expense");
const expenseTitle = document.getElementById("expense-title-input");
const expenseAmount = document.getElementById("expense-amount-input");

const addIncome = document.querySelector(".add-income");
const incomeTitle = document.getElementById("income-title-input");
const incomeAmount = document.getElementById("income-amount-input");

//CAS STORE
const CasStore =
  typeof module === "object" && module.exports
    ? require("./storage")
    : window.CasStore;

//VARIABLES
let STATE;
let ENTRY_LIST;
let balance = 0,
  income = 0,
  outcome = 0;
const DELETE = "delete",
  EDIT = "edit";

function applyState(state) {
  STATE = state;
  ENTRY_LIST = state.entries;
}

function syncFromStorage(persistIfNeeded) {
  var state = CasStore.loadState({ persistIfNeeded: persistIfNeeded });
  applyState(state);
  updateUI();
}

// Commit one operation with CAS and refresh the UI from the new state.
function commitAndRender(op) {
  var result = CasStore.commitWithCas(op, { maxRetries: 5 });
  applyState(result.state);
  updateUI();

  if (!result.ok) {
    // Notify user when concurrent changes cannot be merged.
    console.warn("CAS conflict: please retry your action.");
  }
}

function findEntryById(id) {
  for (var i = 0; i < ENTRY_LIST.length; i += 1) {
    if (ENTRY_LIST[i].id === id) return ENTRY_LIST[i];
  }
  return null;
}

// INITIAL LOAD
syncFromStorage(true);

// Sync from other tabs when storage changes.
window.addEventListener("storage", function (event) {
  if (event.key === CasStore.STORAGE_KEY) {
    syncFromStorage(false);
  }
});

//EVENT LISTENERS
expenseBtn.addEventListener("click", function () {
  show(expenseEl);
  hide([incomeEl, allEl]);
  active(expenseBtn);
  inactive([incomeBtn, allBtn]);
});
incomeBtn.addEventListener("click", function () {
  show(incomeEl);
  hide([expenseEl, allEl]);
  active(incomeBtn);
  inactive([expenseBtn, allBtn]);
});
allBtn.addEventListener("click", function () {
  show(allEl);
  hide([incomeEl, expenseEl]);
  active(allBtn);
  inactive([incomeBtn, expenseBtn]);
});

addExpense.addEventListener("click", function () {
  // CHECK IF ONE OF THE INPUT IS EMPTY => EXIT
  if (!expenseTitle.value || !expenseAmount.value) return;

  // ADD INPUTs TO ENTRY_LIST
  var expense = {
    id: CasStore.generateId(),
    type: "expense",
    title: expenseTitle.value,
    amount: +expenseAmount.value,
  };
  commitAndRender(CasStore.createAddOp(expense));
  clearInput([expenseTitle, expenseAmount]);
});

addIncome.addEventListener("click", function () {
  // CHECK IF ONE OF THE INPUT IS EMPTY => EXIT
  if (!incomeTitle.value || !incomeAmount.value) return;

  // ADD INPUTs TO ENTRY_LIST
  var income = {
    id: CasStore.generateId(),
    type: "income",
    title: incomeTitle.value,
    amount: +incomeAmount.value,
  };
  commitAndRender(CasStore.createAddOp(income));
  clearInput([incomeTitle, incomeAmount]);
});

incomeList.addEventListener("click", deleteOrEdit);
expenseList.addEventListener("click", deleteOrEdit);
allList.addEventListener("click", deleteOrEdit);

// HELEPER FUNCS
function deleteOrEdit(event) {
  const targetBtn = event.target;
  const entry = targetBtn.parentNode;
  const entryId = entry.getAttribute("data-id");

  if (!entryId) return;

  if (targetBtn.id == EDIT) {
    editEntry(entryId);
  } else if (targetBtn.id == DELETE) {
    deleteEntry(entryId);
  }
}

function deleteEntry(entryId) {
  commitAndRender(CasStore.createDeleteOp(entryId));
}

function editEntry(entryId) {
  const ENTRY = findEntryById(entryId);

  if (!ENTRY) return;

  if (ENTRY.type == "income") {
    incomeTitle.value = ENTRY.title;
    incomeAmount.value = ENTRY.amount;
  } else if (ENTRY.type == "expense") {
    expenseTitle.value = ENTRY.title;
    expenseAmount.value = ENTRY.amount;
  }
  deleteEntry(entryId);
}

function updateUI() {
  income = calculateTotal("income", ENTRY_LIST);
  outcome = calculateTotal("expense", ENTRY_LIST);
  balance = Math.abs(calculateBalance(income, outcome));

  let sign = income >= outcome ? "$" : "-$";

  //UPDATE UI
  balanceEl.innerHTML = `<small>${sign}</small>${balance}`;
  outcomeTotalEl.innerHTML = `<small>$</small>${outcome}`;
  incomeTotalEl.innerHTML = `<small>$</small>${income}`;

  clearElement([expenseList, incomeList, allList]);

  ENTRY_LIST.forEach((entry) => {
    if (entry.type == "expense") {
      showEntry(expenseList, entry.type, entry.title, entry.amount, entry.id);
    } else if (entry.type == "income") {
      showEntry(incomeList, entry.type, entry.title, entry.amount, entry.id);
    }
    showEntry(allList, entry.type, entry.title, entry.amount, entry.id);
  });
  updateChart(income, outcome);
}

function showEntry(list, type, title, amount, id) {
  const entry = `<li data-id="${id}" class="${type}">
                    <div class="entry">${title} : $${amount}</div>
                    <div id="edit"></div>
                    <div id="delete"></div>
                  </li>`;
  const position = "afterbegin";
  list.insertAdjacentHTML(position, entry);
}

function clearElement(elements) {
  elements.forEach((element) => {
    element.innerHTML = "";
  });
}

function calculateTotal(type, list) {
  let sum = 0;
  list.forEach((entry) => {
    if (entry.type == type) {
      sum += entry.amount;
    }
  });
  return sum;
}

function calculateBalance(income, outcome) {
  return income - outcome;
}
function clearInput(inputs) {
  inputs.forEach((input) => {
    input.value = "";
  });
}

function show(element) {
  element.classList.remove("hide");
}

function hide(elements) {
  elements.forEach((element) => {
    element.classList.add("hide");
  });
}

function active(element) {
  element.classList.add("focus");
}
function inactive(elements) {
  elements.forEach((element) => {
    element.classList.remove("focus");
  });
}
