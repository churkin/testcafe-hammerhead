import ClientStrategy from './strategy-client';
import DomProcessor from '../../processing/dom/index';

export default new DomProcessor(new ClientStrategy());
