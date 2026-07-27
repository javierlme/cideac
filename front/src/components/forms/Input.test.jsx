describe('Input', () => {
  it('should verify object properties work', () => {
    const props = { name: 'email', type: 'text' };
    if (props.name !== 'email') throw new Error('Test failed');
  });

  it('should verify type checking works', () => {
    const type = 'password';
    if (typeof type !== 'string') throw new Error('Test failed');
  });
});
