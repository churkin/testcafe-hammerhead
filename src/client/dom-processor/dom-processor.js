import ClientStrategy from './dom-processor-strategy-client';
import DomProcessor from '../../dom-processor/dom-processor';

export default new DomProcessor(new ClientStrategy());
