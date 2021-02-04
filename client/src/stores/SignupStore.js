import { extendObservable } from 'mobx';

class SignupStore {
    constructor() {
        extendObservable(this, {
            email: '',
            values: {}
        });
    }
}

export default new SignupStore();