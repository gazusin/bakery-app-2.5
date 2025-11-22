import Dexie, { Table } from 'dexie';
import { Sale, Product, Customer, Expense, AuditLog, Payment } from './types/db-types';

export class BakeryDatabase extends Dexie {
    sales!: Table<Sale, string>;
    products!: Table<Product, string>;
    customers!: Table<Customer, string>;
    expenses!: Table<Expense, string>;
    auditLogs!: Table<AuditLog, string>;
    payments!: Table<Payment, string>;

    constructor() {
        super('BakeryDB');

        this.version(1).stores({
            sales: 'id, date, customerName, paymentMethod, status, branchId',
            products: 'id, category, branchId, name',
            customers: 'id, name, totalDebt',
            expenses: 'id, date, category, branchId',
            auditLogs: 'id, timestamp, userId, module, action, branchId',
            payments: 'id, date, reference, customerId, status, branchId'
        });
    }
}

export const db = new BakeryDatabase();

