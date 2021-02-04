import { extendObservable } from 'mobx';

class AdminStore {
    constructor() {
        extendObservable(this, {
            loading: true,
            loggedIn: false,
            email: undefined,
            name: undefined,
            hasPerm: false,
        });
    }
}

export default new AdminStore();