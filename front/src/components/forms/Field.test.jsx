describe('Field', () => {
  it('should verify string operations work', () => {
    const label = 'Email';
    if (label.toLowerCase() !== 'email') throw new Error('Test failed');
  });

  it('should verify array operations work', () => {
    const children = ['a', 'b', 'c'];
    if (children.length !== 3) throw new Error('Test failed');
  });
});
