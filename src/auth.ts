import * as crypto from 'node:crypto';

interface UserRecord {
    name: string;
    index: string;
    hash: string;
    salt: string;
    score: number;
}

export default class Auth {
    private users = new Map<string, UserRecord>();
    private nameIndex = new Map<string, string>();
    private nextId = 1;

    private _hash(password: string, salt: string) {
        return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    }

    authenticate(name: string, password: string) {
        const existingId = this.nameIndex.get(name);

        if (existingId) {
            const user = this.users.get(existingId)!;
            const hash = this._hash(password, user.salt);

            if (hash === user.hash) {
                return { name, index: user.index, error: false, errorText: "" };
            }
            return { error: true, errorText: "Неверный пароль" };
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const hash = this._hash(password, salt);
        const index = (this.nextId++).toString();

        const user = { index, hash, salt, name, score: 0 };

        this.users.set(index, user);
        this.nameIndex.set(name, index);

        return { name, index, error: false, errorText: "" };
    }

    getPlayerByIndex(id: string) {
        return this.users.get(id);
    }
}