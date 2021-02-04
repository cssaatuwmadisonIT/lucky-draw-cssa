import { extendObservable } from 'mobx';

class UserStore {
    constructor() {
        extendObservable(this, {
            wechat: '',
            values: {}
        });
    }
}

export default new UserStore();