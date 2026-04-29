function setBudgetAppDom() {
  document.body.innerHTML = `
    <div class="budget-container">
      <div class="budget-header">
        <div class="balance"><div class="value"></div></div>
        <div class="income-total"></div>
        <div class="outcome-total"></div>
        <div class="chart"></div>
      </div>

      <div class="toggle">
        <div class="first-tab">Expenses</div>
        <div class="second-tab">Income</div>
        <div class="third-tab focus">All</div>
      </div>

      <div class="hide" id="expense">
        <ul class="list"></ul>
        <input type="text" id="expense-title-input" />
        <input type="number" id="expense-amount-input" />
        <div class="add-expense"></div>
      </div>

      <div class="hide" id="income">
        <ul class="list"></ul>
        <input type="text" id="income-title-input" />
        <input type="number" id="income-amount-input" />
        <div class="add-income"></div>
      </div>

      <div id="all">
        <ul class="list"></ul>
      </div>
    </div>
  `;
}

function click(element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("budget.js (DOM integration)", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    setBudgetAppDom();

    global.updateChart = jest.fn();

    // Load the app after DOM + globals are ready
    require("../budget.js");
  });

  test("does not add income when inputs are empty", () => {
    const addIncome = document.querySelector(".add-income");
    click(addIncome);

    expect(JSON.parse(localStorage.getItem("entry_list"))).toEqual([]);
    expect(global.updateChart).toHaveBeenCalledTimes(1);
  });

  test("adds an income entry and updates totals", () => {
    document.getElementById("income-title-input").value = "Salary";
    document.getElementById("income-amount-input").value = "100";

    click(document.querySelector(".add-income"));

    const stored = JSON.parse(localStorage.getItem("entry_list"));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual({ type: "income", title: "Salary", amount: 100 });

    expect(document.querySelector(".income-total").innerHTML).toBe(
      "<small>$</small>100"
    );
    expect(document.querySelector(".outcome-total").innerHTML).toBe(
      "<small>$</small>0"
    );
    expect(document.querySelector(".balance .value").innerHTML).toBe(
      "<small>$</small>100"
    );

    expect(document.querySelectorAll("#income .list li")).toHaveLength(1);
    expect(document.querySelectorAll("#all .list li")).toHaveLength(1);

    expect(global.updateChart).toHaveBeenLastCalledWith(100, 0);
  });

  test("adds an expense entry and shows negative sign when outcome > income", () => {
    document.getElementById("expense-title-input").value = "Rent";
    document.getElementById("expense-amount-input").value = "50";

    click(document.querySelector(".add-expense"));

    const stored = JSON.parse(localStorage.getItem("entry_list"));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual({ type: "expense", title: "Rent", amount: 50 });

    expect(document.querySelector(".income-total").innerHTML).toBe(
      "<small>$</small>0"
    );
    expect(document.querySelector(".outcome-total").innerHTML).toBe(
      "<small>$</small>50"
    );
    expect(document.querySelector(".balance .value").innerHTML).toBe(
      "<small>-$</small>50"
    );

    expect(global.updateChart).toHaveBeenLastCalledWith(0, 50);
  });

  test("deletes an entry when clicking the delete button", () => {
    document.getElementById("income-title-input").value = "Salary";
    document.getElementById("income-amount-input").value = "100";
    click(document.querySelector(".add-income"));

    const deleteBtn = document.querySelector("#all .list li div#delete");
    click(deleteBtn);

    expect(JSON.parse(localStorage.getItem("entry_list"))).toEqual([]);
    expect(document.querySelectorAll("#all .list li")).toHaveLength(0);
    expect(global.updateChart).toHaveBeenLastCalledWith(0, 0);
  });

  test("edits an expense entry: copies values to inputs and removes entry", () => {
    document.getElementById("expense-title-input").value = "Food";
    document.getElementById("expense-amount-input").value = "20";
    click(document.querySelector(".add-expense"));

    const editBtn = document.querySelector("#all .list li div#edit");
    click(editBtn);

    expect(document.getElementById("expense-title-input").value).toBe("Food");
    expect(document.getElementById("expense-amount-input").value).toBe("20");

    expect(JSON.parse(localStorage.getItem("entry_list"))).toEqual([]);
    expect(document.querySelectorAll("#all .list li")).toHaveLength(0);
  });
});
