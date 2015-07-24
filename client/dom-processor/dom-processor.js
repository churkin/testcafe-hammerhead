import ClientStrategy from './dom-processor-strategy-client';
import DomProcessor from '../../shared/dom-processor';

export default new DomProcessor(new ClientStrategy());
