import {writeFile} from "node:fs";
import readline from 'node:readline';

// работа с вводом выводом
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

const token = await askQuestion('Введите токен:');
rl.close(); // !important

// вспомогательная функция обертка
const myFetch = (body, method) => {
  return fetch('https://invest-public-api.tinkoff.ru/rest/tinkoff.public.invest.api.contract.v1.' + method, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: body
  });
}


// Получаем данные аккаунтов
let requestBody = {
  'status': 'ACCOUNT_STATUS_UNSPECIFIED'
};
const resp = await myFetch(JSON.stringify(requestBody), 'UsersService/GetAccounts');
const accs = await resp.json();

// Получаем данные портфелей
const portfolios = [];
for (let account of accs.accounts) {
  requestBody = {
    "accountId": account.id,
    "currency": "RUB"
  };
  const resp = await myFetch(JSON.stringify(requestBody), 'OperationsService/GetPortfolio');
  const portfolio = await resp.json();
  portfolios.push(portfolio);

  // в портфель сохраняем список операций ввода вывода средств
  portfolio.operations = await getOperationsFor(account.id);
}

// функция получения операций ввода-вывода средств
async function getOperationsFor(accountId) {
  const body = (cursor, accountId) => {
    return {
      "accountId": accountId,
      "cursor": cursor,
      "limit": 1000,
      "operationTypes": [
        "OPERATION_TYPE_INPUT", "OPERATION_TYPE_OUTPUT"
      ],
      "state": "OPERATION_STATE_EXECUTED"
    }
  }

  const operations = [];
  let cursor = ""
  let hasNext = true;
  do {
    const resp = await myFetch(JSON.stringify(body(cursor, accountId)), 'OperationsService/GetOperationsByCursor');
    const ops = await resp.json();
    operations.push(...ops.items);
    cursor = ops.cursor;
    hasNext = ops.hasNext;
  } while (hasNext);

  return operations.map(op => {return {
    currency: op.payment.currency,
    amount: +op.payment.units,
    dateStr: op.date,
    description: op.description
  }});
}

const result = {
  accounts: accs.accounts,
  portfolios: portfolios
}

// Записываем результат в файл
writeFile('t-calc-data.json', JSON.stringify(result,null, 2), 'utf8', () => {});
